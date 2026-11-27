import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../roles.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';

class DeliveryHomeScreen extends StatefulWidget {
  const DeliveryHomeScreen({super.key});

  @override
  State<DeliveryHomeScreen> createState() => _DeliveryHomeScreenState();
}

class _DeliveryHomeScreenState extends State<DeliveryHomeScreen> {
  late Future<void> _loading;
  List<DeliveryModel> _deliveries = [];
  String? _error;
  bool _busy = false;
  bool _initialLoading = true;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loading = _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final deliveries = await ApiClient.instance.myDeliveries();
      if (!mounted) return;
      setState(() {
        _deliveries = deliveries;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _initialLoading = false);
    }
  }

  Future<void> _advance(DeliveryModel delivery) async {
    final isPickup = delivery.isPickup;
    final starting = delivery.status == 'ASSIGNED' || delivery.status == 'PENDING';
    final status = starting ? 'IN_PROGRESS' : 'COMPLETED';
    final label = isPickup
        ? (starting ? 'Start pickup' : 'Hand over at center')
        : (starting ? 'Start return delivery' : 'Confirm delivery');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('$label?'),
        content: Text(
          delivery.order?.bookingCode ?? 'Order ${delivery.orderId}',
          style: const TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Not yet'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await ApiClient.instance.updateDeliveryStatus(
        delivery.id,
        status,
        notes: isPickup
            ? (starting ? 'Pickup started' : 'Shoes handed over to cleaning center')
            : (starting ? 'Return delivery started' : 'Delivered to customer'),
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$label confirmed')),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ApiClient.instance.user;
    final active = _deliveries.where((item) => !item.isDone).toList();
    final done = _deliveries.where((item) => item.isDone).toList();
    final role = AppRole.delivery;
    final liveOrders = active.take(3).map(
      (item) => LiveOrderItem(
        orderId: item.orderId,
        code: item.order?.bookingCode ?? 'Order ${item.orderId}',
        status: item.status,
        detail: [
          item.isPickup ? 'Pickup' : 'Return delivery',
          item.order?.customerName ?? item.assigneeName ?? '',
          item.location,
        ].where((value) => value.isNotEmpty).join(' · '),
        amount: item.order?.totalAmount,
        currency: item.order?.currency ?? 'ETB',
      ),
    ).toList();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 170,
              floating: false,
              pinned: false,
              flexibleSpace: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.navy, Color(0xFF173A5E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 22),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text('${greeting()}, ${user?.firstName ?? 'partner'}',
                            style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12)),
                        const SizedBox(height: 6),
                        const Text('Your delivery tasks',
                            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        if (_initialLoading)
                          const SkeletonLine(width: 150)
                        else
                          Text('${active.length} active · ${done.length} completed',
                              style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
                child: FutureBuilder<void>(
                  future: _loading,
                  builder: (context, snapshot) {
                    final loading = snapshot.connectionState == ConnectionState.waiting &&
                        _deliveries.isEmpty;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_error != null)
                          InlineError(
                            message: _error!,
                            onRetry: () => setState(() => _loading = _load()),
                          ),
                        LiveOrderCard(
                          title: AppRole.liveTitle(role),
                          subtitle: AppRole.liveSubtitle(role),
                          items: liveOrders,
                          onTap: (orderId) => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => OrderDetailScreen(orderId: orderId),
                            ),
                          ),
                        ),
                        const SectionHeader(title: 'Active tasks'),
                        const SizedBox(height: 10),
                        if (loading)
                          const _DeliverySkeleton()
                        else if (active.isEmpty)
                          const _EmptyCard(text: 'No active pickups or returns right now.')
                        else
                          for (final delivery in active)
                            _DeliveryCard(
                              delivery: delivery,
                              busy: _busy,
                              onAdvance: () => _advance(delivery),
                            ),
                        const SizedBox(height: 22),
                        const SectionHeader(title: 'Completed'),
                        const SizedBox(height: 10),
                        if (loading)
                          const _DeliverySkeleton(short: true)
                        else if (done.isEmpty)
                          const _EmptyCard(text: 'Completed deliveries will appear here.')
                        else
                          for (final delivery in done.take(8))
                            _DeliveryCard(delivery: delivery, busy: false, onAdvance: null),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  final DeliveryModel delivery;
  final bool busy;
  final VoidCallback? onAdvance;

  const _DeliveryCard({
    required this.delivery,
    required this.busy,
    required this.onAdvance,
  });

  @override
  Widget build(BuildContext context) {
    final starting = delivery.status == 'ASSIGNED' || delivery.status == 'PENDING';
    final isPickup = delivery.isPickup;
    final actionLabel = isPickup
        ? (starting ? 'Start pickup' : 'Hand over at center')
        : (starting ? 'Start delivery' : 'Confirm delivery');
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(isPickup ? Icons.local_shipping_rounded : Icons.delivery_dining_rounded,
                    color: isPickup ? AppColors.primary : AppColors.teal),
                const SizedBox(width: 8),
                Text(
                  isPickup ? 'Pickup' : 'Return delivery',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                StatusPill(status: delivery.status),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              delivery.order?.bookingCode ?? 'Order ${delivery.orderId}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
            ),
            const SizedBox(height: 5),
            Text(
              delivery.order?.customerName ?? delivery.assigneeName ?? '',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            if (delivery.location.isNotEmpty) ...[
              const SizedBox(height: 5),
              Text(delivery.location,
                  style: const TextStyle(color: AppColors.muted, fontSize: 11)),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => OrderDetailScreen(orderId: delivery.orderId),
                      ),
                    ),
                    child: const Text('Details'),
                  ),
                ),
                if (onAdvance != null) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: busy ? null : onAdvance,
                      child: busy
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(actionLabel),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  final String text;

  const _EmptyCard({required this.text});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Text(text,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 12)),
          ),
        ),
      );
}

class _DeliverySkeleton extends StatelessWidget {
  final bool short;

  const _DeliverySkeleton({this.short = false});

  @override
  Widget build(BuildContext context) => SkeletonCard(
        margin: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                SkeletonBox(width: 18, height: 18, radius: 6),
                SizedBox(width: 10),
                SkeletonLine(width: 90),
                Spacer(),
                SkeletonBox(width: 76, height: 24, radius: 999),
              ],
            ),
            const SizedBox(height: 14),
            const SkeletonLine(width: 140),
            const SizedBox(height: 8),
            SkeletonLine(width: short ? 110 : 180),
            if (!short) ...[
              const SizedBox(height: 16),
              const Row(
                children: [
                  Expanded(child: SkeletonBox(height: 40, radius: 12)),
                  SizedBox(width: 10),
                  Expanded(child: SkeletonBox(height: 40, radius: 12)),
                ],
              ),
            ],
          ],
        ),
      );
}
