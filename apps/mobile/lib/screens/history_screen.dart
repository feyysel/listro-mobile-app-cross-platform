import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../realtime.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<void> _loading;
  final _searchController = TextEditingController();
  Timer? _searchTimer;
  Timer? _pollTimer;
  StreamSubscription<RealtimeEvent>? _realtimeSub;
  List<OrderModel> _orders = [];
  String? _error;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _loading = _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
    _realtimeSub = RealtimeClient.instance.events.listen((event) {
      if (event.type == 'notification') _load();
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _realtimeSub?.cancel();
    _searchTimer?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    if (!mounted) return;
    setState(() => _searching = true);
    _searchTimer?.cancel();
    _searchTimer = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _loading = _load());
    });
  }

  Future<void> _load() async {
    try {
      final orders = await ApiClient.instance.orders(
        search: _searchController.text,
        status: 'DELIVERED',
        includePayments: true,
      );
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _error = null;
        _searching = false;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  double _paid(OrderModel order) => order.payments
      .where((payment) => payment.isCompleted)
      .fold(0.0, (sum, payment) => sum + payment.amount);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order history')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search completed orders',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searchController.text.isEmpty
                    ? null
                    : IconButton(
                        onPressed: _searchController.clear,
                        icon: const Icon(Icons.close_rounded, size: 18),
                      ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: FutureBuilder<void>(
                future: _loading,
                builder: (context, snapshot) {
                  final loading =
                      snapshot.connectionState == ConnectionState.waiting && _orders.isEmpty;
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
                    children: [
                      if (_error != null)
                        InlineError(
                          message: _error!,
                          onRetry: () => setState(() => _loading = _load()),
                        ),
                      if (loading || _searching)
                        for (var index = 0; index < 4; index++)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: _HistorySkeleton(),
                          ),
                      if (!loading && !_searching && _orders.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(28),
                            child: Column(
                              children: [
                                Icon(Icons.history_rounded,
                                    size: 42, color: AppColors.primary),
                                SizedBox(height: 12),
                                Text('No completed orders yet',
                                    style: TextStyle(fontWeight: FontWeight.w800)),
                                SizedBox(height: 6),
                                Text(
                                  'Delivered orders will appear here with their payments.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ),
                      if (!loading && !_searching)
                        for (final order in _orders)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Card(
                              child: ListTile(
                                leading: const Icon(Icons.check_circle_outline_rounded,
                                    color: AppColors.green),
                                title: Row(
                                  children: [
                                    Expanded(
                                      child: Text(order.bookingCode,
                                          style: const TextStyle(fontWeight: FontWeight.w800)),
                                    ),
                                    StatusPill(status: order.status),
                                  ],
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Text(order.customerName.isEmpty
                                        ? '${order.itemCount} item(s)'
                                        : '${order.customerName} · ${order.itemCount} item(s)'),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${money(_paid(order), currency: order.currency)} paid · '
                                      '${order.payments.where((payment) => payment.isCompleted).length}/'
                                      '${order.payments.length} payments · '
                                      '${shortDate(order.completedAt ?? order.placedAt)}',
                                      style: const TextStyle(
                                          color: AppColors.muted, fontSize: 11),
                                    ),
                                  ],
                                ),
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute<void>(
                                      builder: (_) => OrderDetailScreen(orderId: order.id),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistorySkeleton extends StatelessWidget {
  const _HistorySkeleton();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: 12, width: double.infinity),
            SizedBox(height: 8),
            SizedBox(height: 10, width: 140),
          ],
        ),
      ),
    );
  }
}
