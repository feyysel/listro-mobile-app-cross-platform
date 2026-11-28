import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../realtime.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
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
        liveOnly: true,
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Live orders')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 6),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search booking code or service',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: _searching
                    ? const Padding(
                        padding: EdgeInsets.all(13),
                        child: SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : (_searchController.text.isEmpty
                        ? null
                        : IconButton(
                            onPressed: _searchController.clear,
                            icon: const Icon(Icons.close_rounded, size: 18),
                          )),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: FutureBuilder<void>(
                future: _loading,
                builder: (context, snapshot) {
                  final loading = snapshot.connectionState == ConnectionState.waiting &&
                      _orders.isEmpty;
                  final orders = _orders;
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
                            child: _OrderSkeleton(),
                          ),
                      if (!loading && !_searching && orders.isEmpty)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(28),
                            child: Column(
                              children: [
                                const Icon(Icons.receipt_long_rounded,
                                    size: 42, color: AppColors.primary),
                                const SizedBox(height: 12),
                                const Text('No orders here yet',
                                    style: TextStyle(fontWeight: FontWeight.w800)),
                                const SizedBox(height: 6),
                                Text(
                                  _searchController.text.isEmpty
                                      ? 'Only live orders appear here. Completed orders are in History.'
                                      : 'No orders match “${_searchController.text}”.',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                        ),
                      if (!loading && !_searching)
                        for (final order in orders)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _OrderCard(order: order),
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

class _OrderCard extends StatelessWidget {
  final OrderModel order;

  const _OrderCard({required this.order});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: order.id)),
        ),
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(order.bookingCode, style: const TextStyle(fontWeight: FontWeight.w800)),
                  const Spacer(),
                  StatusPill(status: order.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                shortDate(order.placedAt),
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(Icons.checkroom_rounded, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text('${order.itemCount} item(s)'),
                  const Spacer(),
                  Text(money(order.totalAmount, currency: order.currency),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrderSkeleton extends StatelessWidget {
  const _OrderSkeleton();

  @override
  Widget build(BuildContext context) => const SkeletonCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SkeletonLine(width: 120),
                Spacer(),
                SkeletonBox(width: 76, height: 24, radius: 999),
              ],
            ),
            SizedBox(height: 12),
            SkeletonLine(width: 90),
            SizedBox(height: 16),
            Row(
              children: [
                SkeletonBox(width: 18, height: 18, radius: 6),
                SizedBox(width: 10),
                SkeletonLine(width: 70),
                Spacer(),
                SkeletonLine(width: 80),
              ],
            ),
          ],
        ),
      );
}
