import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'booking_screen.dart';
import 'order_detail_screen.dart';
import 'orders_screen.dart';
import 'payment_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<void> _loading;
  List<ServiceModel> _services = [];
  List<AddressModel> _addresses = [];
  List<OrderModel> _orders = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _loading = _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.services(),
        ApiClient.instance.addresses(),
        ApiClient.instance.orders(),
      ]);
      if (!mounted) return;
      setState(() {
        _services = results[0] as List<ServiceModel>;
        _addresses = results[1] as List<AddressModel>;
        _orders = results[2] as List<OrderModel>;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _openBooking(ServiceModel service) async {
    final created = await Navigator.of(context).push<OrderModel>(
      MaterialPageRoute(
        builder: (_) => BookingScreen(service: service, addresses: _addresses),
      ),
    );
    if (created == null) return;
    PaymentRequirements? requirements;
    try {
      requirements = await ApiClient.instance.paymentRequirements(created.id);
    } catch (_) {
      requirements = null;
    }
    final suggested = requirements == null
        ? created.totalAmount / 2
        : (requirements.depositMissing > 0
            ? requirements.depositMissing
            : requirements.depositRequired);
    if (!mounted) return;
    final paid = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PaymentScreen(
          orderId: created.id,
          kind: 'DEPOSIT',
          suggestedAmount: suggested,
          bookingCode: created.bookingCode,
        ),
      ),
    );
    if (paid == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Deposit submitted for verification')),
      );
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final user = ApiClient.instance.user;
    final activeOrders = _orders.where((order) => !['DELIVERED', 'CANCELLED', 'REJECTED'].contains(order.status)).toList();
    final latest = activeOrders.isNotEmpty ? activeOrders.first : null;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 210,
              floating: false,
              pinned: false,
              flexibleSpace: Stack(
                fit: StackFit.expand,
                children: [
                  Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.navy, Color(0xFF202B4A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                  ),
                  Positioned(
                    right: -40,
                    top: -50,
                    child: Container(
                      width: 220,
                      height: 220,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.secondary.withValues(alpha: 0.22),
                      ),
                    ),
                  ),
                  SafeArea(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        if (constraints.maxHeight < 90) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.fromLTRB(22, 18, 22, 26),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Row(
                                children: [
                                  CircleAvatar(
                                    radius: 22,
                                    backgroundColor: Colors.white.withValues(alpha: 0.14),
                                    child: Text(
                                      '${user?.firstName[0] ?? 'L'}${user?.lastName[0] ?? ''}',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          '${greeting()}, ${user?.firstName ?? 'there'}',
                                          style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 13),
                                        ),
                                        const SizedBox(height: 3),
                                        const Text(
                                          'Let’s make your shoes shine.',
                                          style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
                child: FutureBuilder<void>(
                  future: _loading,
                  builder: (context, snapshot) {
                    final loading = snapshot.connectionState == ConnectionState.waiting &&
                        _services.isEmpty &&
                        _orders.isEmpty;
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_error != null)
                          InlineError(
                            message: _error!,
                            onRetry: () => setState(() => _loading = _load()),
                          ),
                        _QuickActions(
                          onBook: () {
                            if (_services.isNotEmpty) _openBooking(_services.first);
                          },
                          onTrack: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const OrdersScreen()),
                          ),
                        ),
                        const SizedBox(height: 22),
                        if (loading) ...[
                          const SectionHeader(title: 'Active order'),
                          const SizedBox(height: 10),
                          const _HomeOrderSkeleton(),
                          const SizedBox(height: 22),
                          const SectionHeader(title: 'Cleaning services'),
                          const SizedBox(height: 10),
                          const _HomeServiceSkeleton(),
                          const _HomeServiceSkeleton(),
                        ] else ...[
                          if (latest != null) ...[
                            SectionHeader(
                              title: 'Active order',
                              action: 'See all',
                              onAction: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const OrdersScreen()),
                              ),
                            ),
                            _ActiveOrderCard(
                              order: latest,
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => OrderDetailScreen(orderId: latest.id),
                                ),
                              ),
                            ),
                            const SizedBox(height: 22),
                          ],
                          const SectionHeader(title: 'Cleaning services'),
                          const SizedBox(height: 10),
                          for (final service in _services)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _ServiceCard(
                                service: service,
                                onTap: () => _openBooking(service),
                              ),
                            ),
                        ],
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

class _QuickActions extends StatelessWidget {
  final VoidCallback onBook;
  final VoidCallback onTrack;

  const _QuickActions({required this.onBook, required this.onTrack});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Icons.auto_awesome_rounded,
            title: 'Book a clean',
            subtitle: 'Pickup included',
            color: AppColors.primary,
            onTap: onBook,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _ActionTile(
            icon: Icons.local_shipping_rounded,
            title: 'Track order',
            subtitle: 'Live status',
            color: AppColors.teal,
            onTap: onTrack,
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE7EAF0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: color, size: 21),
              ),
              const SizedBox(height: 14),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              const SizedBox(height: 3),
              Text(subtitle, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  final OrderModel order;
  final VoidCallback onTap;

  const _ActiveOrderCard({required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(18),
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
              const SizedBox(height: 12),
              Text(
                '${order.itemCount} item(s) · ${order.branchName}',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: const LinearProgressIndicator(
                  value: 0.45,
                  minHeight: 7,
                  backgroundColor: Color(0xFFEEF0F5),
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(shortDate(order.placedAt), style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                  Text(money(order.totalAmount, currency: order.currency), style: const TextStyle(fontWeight: FontWeight.w800)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final ServiceModel service;
  final VoidCallback onTap;

  const _ServiceCard({required this.service, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEEF0FF), Color(0xFFF6EDFF)],
                  ),
                ),
                child: const Icon(Icons.cleaning_services_rounded, color: AppColors.primary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(service.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(
                      service.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted, fontSize: 11, height: 1.35),
                    ),
                    if (service.durationMinutes != null) ...[
                      const SizedBox(height: 6),
                      Text('~${service.durationMinutes} min', style: const TextStyle(color: AppColors.teal, fontSize: 10)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(money(service.price), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  const SizedBox(height: 8),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.primary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeOrderSkeleton extends StatelessWidget {
  const _HomeOrderSkeleton();

  @override
  Widget build(BuildContext context) => const SkeletonCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SkeletonLine(width: 110),
                Spacer(),
                SkeletonBox(width: 74, height: 24, radius: 999),
              ],
            ),
            SizedBox(height: 14),
            SkeletonLine(width: 150),
            SizedBox(height: 16),
            SkeletonBox(height: 7, radius: 999),
            SizedBox(height: 10),
            Row(
              children: [
                SkeletonLine(width: 70),
                Spacer(),
                SkeletonLine(width: 80),
              ],
            ),
          ],
        ),
      );
}

class _HomeServiceSkeleton extends StatelessWidget {
  const _HomeServiceSkeleton();

  @override
  Widget build(BuildContext context) => const SkeletonCard(
        padding: EdgeInsets.all(16),
        child: Row(
          children: [
            SkeletonAvatar(size: 52),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonLine(width: 130),
                  SizedBox(height: 8),
                  SkeletonLine(width: 190),
                ],
              ),
            ),
            SizedBox(width: 10),
            SkeletonLine(width: 50),
          ],
        ),
      );
}
