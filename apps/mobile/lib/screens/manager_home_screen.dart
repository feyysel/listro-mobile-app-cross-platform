import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../realtime.dart';
import '../roles.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';

class ManagerHomeScreen extends StatefulWidget {
  const ManagerHomeScreen({super.key});

  @override
  State<ManagerHomeScreen> createState() => _ManagerHomeScreenState();
}

class _ManagerHomeScreenState extends State<ManagerHomeScreen> {
  late Future<void> _loading;
  List<OrderModel> _orders = [];
  List<WashingTaskModel> _tasks = [];
  List<EmployeeModel> _deliveryEmployees = [];
  List<EmployeeModel> _operators = [];
  String? _selectedDeliveryId;
  String? _error;
  bool _busy = false;
  bool _initialLoading = true;
  Timer? _pollTimer;
  StreamSubscription<RealtimeEvent>? _realtimeSub;

  @override
  void initState() {
    super.initState();
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
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ApiClient.instance.orders(),
        ApiClient.instance.centerTasks().catchError((_) => <WashingTaskModel>[]),
        ApiClient.instance.employees(role: 'DELIVERY'),
        ApiClient.instance.employees(role: 'OPERATOR'),
      ]);
      if (!mounted) return;
      setState(() {
        _orders = results[0] as List<OrderModel>;
        _tasks = results[1] as List<WashingTaskModel>;
        _deliveryEmployees = results[2] as List<EmployeeModel>;
        _operators = results[3] as List<EmployeeModel>;
        final selectedDeliveryId = _selectedDeliveryId;
        if (selectedDeliveryId == null ||
            !_deliveryEmployees.any((employee) => employee.id == selectedDeliveryId)) {
          _selectedDeliveryId =
              _deliveryEmployees.isEmpty ? null : _deliveryEmployees.first.id;
        }
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _initialLoading = false);
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success)));
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(OrderModel order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this order?'),
        content: Text('Order ${order.bookingCode} will be cancelled and the customer notified.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep order'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.rose),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _run(
      () => ApiClient.instance.cancelOrder(order.id, 'Cancelled by manager'),
      'Order cancelled',
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ApiClient.instance.user;
    final role = user?.role ?? AppRole.manager;
    final liveOrders = _orders
        .where((order) => AppRole.liveStatuses(role).contains(order.status))
        .take(3)
        .map(
          (order) => LiveOrderItem(
            orderId: order.id,
            code: order.bookingCode,
            status: order.status,
            detail: '${order.customerName} · ${order.itemCount} item(s)',
            placedAt: order.placedAt,
            amount: order.totalAmount,
            currency: order.currency,
          ),
        )
        .toList();
    final placed = _orders.where((order) => order.status == 'PLACED').toList();
    final confirmed = _orders.where((order) => order.status == 'CONFIRMED').toList();
    final unassignedTasks =
        _tasks.where((task) => task.status == 'PENDING' || task.status == 'ASSIGNED').toList();
    final selectedDelivery = _deliveryEmployees.isEmpty
        ? null
        : _deliveryEmployees.firstWhere(
            (employee) => employee.id == _selectedDeliveryId,
            orElse: () => _deliveryEmployees.first,
          );
    final operator = _operators.isEmpty ? null : _operators.first;

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
                    colors: [AppColors.navy, Color(0xFF3B2E6D)],
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
                        Text('${greeting()}, ${user?.firstName ?? 'manager'}',
                            style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12)),
                        const SizedBox(height: 6),
                        const Text('Operations overview',
                            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        if (_initialLoading)
                          const SkeletonLine(width: 170)
                        else
                          Text('${placed.length} to confirm · ${confirmed.length} to dispatch',
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
                        _orders.isEmpty;
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
                        const SectionHeader(title: 'Waiting for confirmation'),
                        const SizedBox(height: 10),
                        if (loading)
                          const _OrderSkeleton()
                        else if (placed.isEmpty)
                          const _EmptyCard(text: 'No new orders right now.')
                        else
                          for (final order in placed)
                            _OrderCard(
                              order: order,
                              busy: _busy,
                              actionLabel: 'Confirm order',
                              onAction: () => _run(
                                () => ApiClient.instance.confirmOrder(order.id),
                                'Order confirmed',
                              ),
                              onCancel: () => _cancel(order),
                            ),
                        const SizedBox(height: 22),
                        const SectionHeader(title: 'Need pickup assignment'),
                        const SizedBox(height: 10),
                        if (loading)
                          const _OrderSkeleton()
                        else if (confirmed.isEmpty)
                          const _EmptyCard(text: 'No confirmed orders waiting for pickup.')
                        else
                          for (final order in confirmed)
                            _OrderCard(
                              order: order,
                              busy: _busy || selectedDelivery == null,
                              deliveryEmployees: _deliveryEmployees,
                              selectedDeliveryId: _selectedDeliveryId,
                              onDeliveryChanged: (id) =>
                                  setState(() => _selectedDeliveryId = id),
                              actionLabel: selectedDelivery == null
                                  ? 'No delivery partner'
                                  : 'Assign ${selectedDelivery.name}',
                              onAction: selectedDelivery == null
                                  ? null
                                  : () => _run(
                                      () => ApiClient.instance
                                          .assignPickup(order.id, selectedDelivery.id),
                                      'Pickup assigned',
                                    ),
                              onCancel: () => _cancel(order),
                            ),
                        const SizedBox(height: 22),
                        const SectionHeader(title: 'Cleaning queue'),
                        const SizedBox(height: 10),
                        if (loading)
                          const SkeletonCard(
                            margin: EdgeInsets.only(bottom: 10),
                            child: Row(
                              children: [
                                SkeletonBox(width: 18, height: 18, radius: 6),
                                SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      SkeletonLine(width: 120),
                                      SizedBox(height: 6),
                                      SkeletonLine(width: 160),
                                    ],
                                  ),
                                ),
                                SkeletonBox(width: 72, height: 36, radius: 12),
                              ],
                            ),
                          )
                        else if (unassignedTasks.isEmpty)
                          const _EmptyCard(text: 'No cleaning tasks waiting.')
                        else
                          for (final task in unassignedTasks)
                            Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  children: [
                                    const Icon(Icons.cleaning_services_rounded, color: AppColors.teal),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(task.serviceName,
                                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                                          const SizedBox(height: 3),
                                          Text('${task.bookingCode ?? task.orderId} · ${task.shoeCategory}',
                                              style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                                        ],
                                      ),
                                    ),
                                    FilledButton.tonal(
                                      onPressed: _busy || operator == null
                                          ? null
                                          : () => _run(
                                              () => ApiClient.instance.assignTask(task.id, operator.id),
                                              'Task assigned',
                                            ),
                                      child: Text(operator == null ? 'No operator' : 'Assign'),
                                    ),
                                  ],
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
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final OrderModel order;
  final bool busy;
  final String actionLabel;
  final VoidCallback? onAction;
  final VoidCallback onCancel;
  final List<EmployeeModel>? deliveryEmployees;
  final String? selectedDeliveryId;
  final ValueChanged<String?>? onDeliveryChanged;

  const _OrderCard({
    required this.order,
    required this.busy,
    required this.actionLabel,
    required this.onAction,
    required this.onCancel,
    this.deliveryEmployees,
    this.selectedDeliveryId,
    this.onDeliveryChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
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
            const SizedBox(height: 6),
            Text(
              '${order.customerName} · ${order.itemCount} item(s) · ${money(order.totalAmount, currency: order.currency)}',
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
            if (deliveryEmployees != null) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedDeliveryId,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Delivery person',
                  prefixIcon: Icon(Icons.local_shipping_rounded),
                  border: OutlineInputBorder(),
                ),
                items: [
                  for (final employee in deliveryEmployees!)
                    DropdownMenuItem<String>(
                      value: employee.id,
                      child: Text(employee.name, overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: busy ? null : onDeliveryChanged,
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: order.id)),
                    ),
                    child: const Text('Details'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: busy ? null : onAction,
                    child: busy
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(actionLabel, textAlign: TextAlign.center),
                  ),
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: onCancel,
                child: const Text('Cancel order',
                    style: TextStyle(color: AppColors.rose, fontSize: 12)),
              ),
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
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Text(text,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        ),
      );
}

class _OrderSkeleton extends StatelessWidget {
  const _OrderSkeleton();

  @override
  Widget build(BuildContext context) => const SkeletonCard(
        margin: EdgeInsets.only(bottom: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SkeletonLine(width: 90),
                Spacer(),
                SkeletonBox(width: 76, height: 24, radius: 999),
              ],
            ),
            SizedBox(height: 8),
            SkeletonLine(width: 190),
            SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: SkeletonBox(height: 40, radius: 12)),
                SizedBox(width: 10),
                Expanded(child: SkeletonBox(height: 40, radius: 12)),
              ],
            ),
          ],
        ),
      );
}
