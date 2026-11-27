import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../roles.dart';
import '../theme.dart';
import '../widgets.dart';
import 'payment_screen.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late Future<void> _loading;
  OrderModel? _order;
  PaymentRequirements? _requirements;
  List<PaymentModel> _payments = [];
  RatingModel? _rating;
  List<DeliveryModel> _deliveries = [];
  List<EmployeeModel> _deliveryEmployees = [];
  String? _selectedDeliveryId;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loading = _load();
  }

  bool get _isManager => AppRole.isManager(ApiClient.instance.user?.role ?? AppRole.customer);

  Future<PaymentRequirements?> _requirementsOrNull(String orderId) async {
    try {
      return await ApiClient.instance.paymentRequirements(orderId);
    } catch (_) {
      return null;
    }
  }

  Future<List<PaymentModel>> _paymentsOrEmpty(String orderId) async {
    try {
      return await ApiClient.instance.payments(orderId);
    } catch (_) {
      return <PaymentModel>[];
    }
  }

  Future<RatingModel?> _ratingOrNull(String orderId) async {
    try {
      return await ApiClient.instance.rating(orderId);
    } catch (_) {
      return null;
    }
  }

  Future<List<DeliveryModel>> _deliveriesOrEmpty(String orderId) async {
    try {
      return await ApiClient.instance.orderDeliveries(orderId);
    } catch (_) {
      return <DeliveryModel>[];
    }
  }

  Future<List<EmployeeModel>> _deliveryEmployeesOrEmpty() async {
    try {
      return await ApiClient.instance.employees(role: AppRole.delivery);
    } catch (_) {
      return <EmployeeModel>[];
    }
  }

  Future<void> _load() async {
    final manager = _isManager;
    try {
      final results = await Future.wait<dynamic>([
        ApiClient.instance.order(widget.orderId),
        _requirementsOrNull(widget.orderId),
        _paymentsOrEmpty(widget.orderId),
        _ratingOrNull(widget.orderId),
        _deliveriesOrEmpty(widget.orderId),
        if (manager) _deliveryEmployeesOrEmpty(),
      ]);
      if (!mounted) return;
      setState(() {
        _order = results[0] as OrderModel;
        _requirements = results[1] as PaymentRequirements?;
        _payments = results[2] as List<PaymentModel>;
        _rating = results[3] as RatingModel?;
        _deliveries = results[4] as List<DeliveryModel>;
        _deliveryEmployees = manager ? results[5] as List<EmployeeModel> : <EmployeeModel>[];
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
    }
  }

  Future<void> _run(Future<void> Function() action, String success, {bool pop = false}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success)));
      if (pop) Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openPayment(String kind, double amount) async {
    final order = _order;
    if (order == null) return;
    final paid = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PaymentScreen(
          orderId: order.id,
          kind: kind,
          suggestedAmount: amount,
          bookingCode: order.bookingCode,
        ),
      ),
    );
    if (paid == true) await _load();
  }

  Future<void> _rate() async {
    final order = _order;
    if (order == null) return;
    final controller = TextEditingController(text: _rating?.comment ?? '');
    int score = _rating?.score ?? 5;
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Rate your clean'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('How was your Listro experience?'),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var value = 1; value <= 5; value++)
                    IconButton(
                      onPressed: () => setDialogState(() => score = value),
                      icon: Icon(
                        value <= score ? Icons.star_rounded : Icons.star_border_rounded,
                        color: value <= score ? Colors.amber : AppColors.muted,
                        size: 34,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Comment (optional)'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Not now'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Submit rating'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true) return;
    await _run(
      () async {
        await ApiClient.instance.submitRating(order.id, score, controller.text.trim());
      },
      'Thank you for your feedback',
    );
  }

  Future<void> _cancel() async {
    final order = _order;
    if (order == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this order?'),
        content: Text(
          _isManager
              ? 'Order ${order.bookingCode} will be cancelled and the customer notified.'
              : 'You can cancel only while the order is waiting for confirmation.',
        ),
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
      () => ApiClient.instance.cancelOrder(
        order.id,
        _isManager ? 'Cancelled by manager' : 'Cancelled by customer',
      ),
      'Order cancelled',
      pop: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = ApiClient.instance.user?.role ?? AppRole.customer;
    return Scaffold(
      appBar: AppBar(title: const Text('Order detail')),
      body: FutureBuilder<void>(
        future: _loading,
        builder: (context, snapshot) {
          final order = _order;
          if (order == null) {
            return RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
                children: [
                  if (_error != null)
                    InlineError(
                      message: _error!,
                      onRetry: () => setState(() => _loading = _load()),
                    ),
                  const _OrderDetailSkeleton(),
                ],
              ),
            );
          }
          final requirements = _requirements;
          final cancellable = _isManager
              ? !['DELIVERED', 'CANCELLED', 'REJECTED'].contains(order.status)
              : ['PLACED', 'CONFIRMED'].contains(order.status);
          final hasReturn = _deliveries.any((delivery) => delivery.type == 'RETURN');
          final selectedDelivery = _deliveryEmployees.isEmpty
              ? null
              : _deliveryEmployees.firstWhere(
                  (employee) => employee.id == _selectedDeliveryId,
                  orElse: () => _deliveryEmployees.first,
                );

          return RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    gradient: const LinearGradient(
                      colors: [AppColors.navy, Color(0xFF273556)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            order.bookingCode,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const Spacer(),
                          StatusPill(status: order.status),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        money(order.totalAmount, currency: order.currency),
                        style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Placed ${shortDate(order.placedAt)} · ${order.branchName}',
                        style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: AppColors.rose, fontSize: 12)),
                ],
                const SizedBox(height: 20),
                _ActionSection(
                  busy: _busy,
                  buttons: [
                    if (role == AppRole.customer &&
                        requirements != null &&
                        !requirements.depositComplete)
                      _ActionButton(
                        label: 'Pay 50% deposit',
                        icon: Icons.payment_rounded,
                        onPressed: () => _openPayment(
                          'DEPOSIT',
                          requirements.depositMissing > 0
                              ? requirements.depositMissing
                              : requirements.depositRequired,
                        ),
                      ),
                    if (role == AppRole.customer &&
                        order.status == 'DELIVERED' &&
                        requirements != null &&
                        !requirements.fullyPaid)
                      _ActionButton(
                        label: 'Pay final balance',
                        icon: Icons.account_balance_wallet_rounded,
                        onPressed: () => _openPayment('FINAL', requirements.outstanding),
                      ),
                    if (role == AppRole.customer &&
                        order.status == 'DELIVERED' &&
                        (requirements == null || requirements.fullyPaid) &&
                        _rating == null)
                      _ActionButton(
                        label: 'Rate service',
                        icon: Icons.star_rounded,
                        onPressed: _rate,
                      ),
                    if (_isManager && order.status == 'PLACED')
                      _ActionButton(
                        label: 'Confirm order',
                        icon: Icons.check_circle_outline_rounded,
                        onPressed: () => _run(
                          () => ApiClient.instance.confirmOrder(order.id),
                          'Order confirmed',
                        ),
                      ),
                    if (_isManager && order.status == 'CONFIRMED') ...[
                      if (_deliveryEmployees.isNotEmpty)
                        DropdownButtonFormField<String>(
                          initialValue: _selectedDeliveryId,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Delivery person',
                            prefixIcon: Icon(Icons.local_shipping_rounded),
                            border: OutlineInputBorder(),
                          ),
                          items: [
                            for (final employee in _deliveryEmployees)
                              DropdownMenuItem<String>(
                                value: employee.id,
                                child: Text(employee.name, overflow: TextOverflow.ellipsis),
                              ),
                          ],
                          onChanged: _busy
                              ? null
                              : (id) => setState(() => _selectedDeliveryId = id),
                        ),
                      _ActionButton(
                        label: selectedDelivery == null
                            ? 'No delivery partner'
                            : 'Assign ${selectedDelivery.name}',
                        icon: Icons.local_shipping_rounded,
                        enabled: selectedDelivery != null,
                        onPressed: selectedDelivery == null
                            ? () {}
                            : () => _run(
                                () => ApiClient.instance.assignPickup(
                                  order.id,
                                  selectedDelivery.id,
                                ),
                                'Pickup assigned',
                              ),
                      ),
                    ],
                    if (order.status == 'READY_FOR_DELIVERY' && !hasReturn)
                      _ActionButton(
                        label: 'Request return delivery',
                        icon: Icons.delivery_dining_rounded,
                        onPressed: () => _run(
                          () async {
                            await ApiClient.instance.createReturn(order.id);
                          },
                          'Delivery partner notified',
                        ),
                      ),
                    if ((role == AppRole.operator || _isManager) &&
                        order.status == 'WASHING_COMPLETED')
                      _ActionButton(
                        label: 'Mark cleaning ready',
                        icon: Icons.cleaning_services_rounded,
                        onPressed: () => _run(
                          () => ApiClient.instance.markOrderReady(order.id),
                          'Cleaning marked ready',
                        ),
                      ),
                    if (cancellable)
                      _ActionButton(
                        label: 'Cancel order',
                        icon: Icons.cancel_outlined,
                        color: AppColors.rose,
                        onPressed: _cancel,
                      ),
                  ],
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Progress'),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        for (var index = 0; index < order.statusHistory.length; index++)
                          _TimelineRow(
                            event: order.statusHistory[index],
                            isLast: index == order.statusHistory.length - 1,
                          ),
                        if (order.statusHistory.isEmpty)
                          const Text('Status updates will appear here.', style: TextStyle(color: AppColors.muted)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const SectionHeader(title: 'Payments'),
                if (requirements != null)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _PaymentLine('Order total', money(requirements.total, currency: order.currency)),
                          _PaymentLine('Deposit required', money(requirements.depositRequired, currency: order.currency)),
                          _PaymentLine('Verified deposit', money(requirements.depositPaid, currency: order.currency)),
                          _PaymentLine('Outstanding', money(requirements.outstanding, currency: order.currency)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              StatusPill(
                                status: requirements.depositComplete ? 'DEPOSIT VERIFIED' : 'DEPOSIT PENDING',
                              ),
                              const SizedBox(width: 8),
                              if (requirements.fullyPaid) const StatusPill(status: 'PAID'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                for (final payment in _payments)
                  Card(
                    margin: const EdgeInsets.only(top: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                '${payment.isDeposit ? 'Deposit' : 'Final payment'} · ${money(payment.amount, currency: order.currency)}',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                              ),
                              const Spacer(),
                              StatusPill(status: payment.status),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Text(
                            '${payment.method.replaceAll('_', ' ')} · ${payment.reference ?? 'No reference'}',
                            style: const TextStyle(color: AppColors.muted, fontSize: 11),
                          ),
                          if (_isManager && !payment.isCompleted) ...[
                            const SizedBox(height: 10),
                            FilledButton.tonal(
                              onPressed: _busy
                                  ? null
                                  : () => _run(
                                      () => ApiClient.instance.verifyPayment(payment.id),
                                      'Payment verified',
                                    ),
                              child: const Text('Verify payment'),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                if (_payments.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('No payments recorded yet.',
                          style: TextStyle(color: AppColors.muted, fontSize: 12)),
                    ),
                  ),
                if (_rating != null) ...[
                  const SizedBox(height: 22),
                  const SectionHeader(title: 'Your rating'),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.star_rounded, color: Colors.amber),
                      title: Text('${_rating!.score}/5'),
                      subtitle: _rating!.comment == null || _rating!.comment!.isEmpty
                          ? null
                          : Text(_rating!.comment!),
                    ),
                  ),
                ],
                if (_deliveries.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  const SectionHeader(title: 'Deliveries'),
                  for (final delivery in _deliveries)
                    Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        leading: Icon(
                          delivery.isPickup ? Icons.local_shipping_rounded : Icons.delivery_dining_rounded,
                          color: AppColors.teal,
                        ),
                        title: Text(delivery.isPickup ? 'Pickup' : 'Return delivery'),
                        subtitle: Text([
                          delivery.assigneeName,
                          delivery.location,
                        ].where((value) => value != null && value.isNotEmpty).join(' · ')),
                        trailing: StatusPill(status: delivery.status),
                      ),
                    ),
                ],
                const SizedBox(height: 22),
                const SectionHeader(title: 'Items'),
                for (final item in order.items)
                  Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: Color(0xFFEEF0FF),
                        child: Icon(Icons.checkroom_rounded, color: AppColors.primary),
                      ),
                      title: Text(item.serviceName, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${item.shoeCategory} · Qty ${item.quantity}'),
                      trailing: Text(money(item.totalPrice)),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ActionSection extends StatelessWidget {
  final bool busy;
  final List<Widget> buttons;

  const _ActionSection({required this.busy, required this.buttons});

  @override
  Widget build(BuildContext context) {
    if (buttons.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionHeader(title: 'Actions'),
        const SizedBox(height: 10),
        for (final button in buttons)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: IgnorePointer(
              ignoring: busy,
              child: Opacity(opacity: busy ? 0.6 : 1, child: button),
            ),
          ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final Color color;
  final bool enabled;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.color = AppColors.primary,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonalIcon(
      onPressed: enabled ? onPressed : null,
      icon: Icon(icon),
      label: Text(label),
      style: FilledButton.styleFrom(
        foregroundColor: color,
        backgroundColor: color.withValues(alpha: 0.10),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}

class _PaymentLine extends StatelessWidget {
  final String label;
  final String value;

  const _PaymentLine(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 7),
        child: Row(
          children: [
            Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            const Spacer(),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
          ],
        ),
      );
}

class _TimelineRow extends StatelessWidget {
  final StatusEvent event;
  final bool isLast;

  const _TimelineRow({required this.event, required this.isLast});

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        children: [
          Column(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
              if (!isLast) Expanded(child: Container(width: 2, color: const Color(0xFFE0E4EC))),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.status.replaceAll('_', ' '),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 3),
                  Text(shortDate(event.createdAt), style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                  if (event.note != null && event.note!.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(event.note!, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderDetailSkeleton extends StatelessWidget {
  const _OrderDetailSkeleton();

  @override
  Widget build(BuildContext context) => const Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SkeletonBox(height: 132, radius: 24),
          SizedBox(height: 22),
          SectionHeader(title: 'Progress'),
          SizedBox(height: 10),
          SkeletonCard(
            child: Column(
              children: [
                _SkeletonTimelineRow(),
                _SkeletonTimelineRow(),
                _SkeletonTimelineRow(short: true),
              ],
            ),
          ),
          SizedBox(height: 22),
          SectionHeader(title: 'Payments'),
          SizedBox(height: 10),
          SkeletonCard(
            child: Column(
              children: [
                SkeletonLine(),
                SizedBox(height: 10),
                SkeletonLine(width: 180),
                SizedBox(height: 10),
                SkeletonLine(width: 140),
              ],
            ),
          ),
          SizedBox(height: 22),
          SectionHeader(title: 'Items'),
          SizedBox(height: 10),
          SkeletonCard(
            child: Row(
              children: [
                SkeletonAvatar(size: 42),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLine(width: 130),
                      SizedBox(height: 8),
                      SkeletonLine(width: 90),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      );
}

class _SkeletonTimelineRow extends StatelessWidget {
  final bool short;

  const _SkeletonTimelineRow({this.short = false});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Row(
          children: [
            const SkeletonBox(width: 14, height: 14, radius: 999),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonLine(width: short ? 90 : 130),
                  const SizedBox(height: 6),
                  SkeletonLine(width: short ? 70 : 100),
                ],
              ),
            ),
          ],
        ),
      );
}
