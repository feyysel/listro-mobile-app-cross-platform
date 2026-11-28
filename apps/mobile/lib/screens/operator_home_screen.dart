import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../realtime.dart';
import '../roles.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';

class OperatorHomeScreen extends StatefulWidget {
  const OperatorHomeScreen({super.key});

  @override
  State<OperatorHomeScreen> createState() => _OperatorHomeScreenState();
}

class _OperatorHomeScreenState extends State<OperatorHomeScreen> {
  late Future<void> _loading;
  List<WashingTaskModel> _tasks = [];
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
      final tasks = await ApiClient.instance.myTasks();
      if (!mounted) return;
      setState(() {
        _tasks = tasks;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _initialLoading = false);
    }
  }

  Future<void> _setStatus(WashingTaskModel task, String status) async {
    setState(() => _busy = true);
    try {
      await ApiClient.instance.updateTaskStatus(
        task.id,
        status,
        notes: status == 'IN_PROGRESS' ? 'Cleaning started' : 'Cleaning completed',
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(status == 'IN_PROGRESS' ? 'Cleaning started' : 'Task completed')),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _markReady(String orderId) async {
    setState(() => _busy = true);
    try {
      await ApiClient.instance.markOrderReady(orderId);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Delivery has been notified that cleaning is complete')),
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
    final active = _tasks.where((task) => !task.isCompleted).toList();
    final completed = _tasks.where((task) => task.isCompleted).toList();
    final role = AppRole.operator;
    final liveOrders = active.take(3).map(
      (task) => LiveOrderItem(
        orderId: task.orderId,
        code: task.bookingCode ?? task.orderId,
        status: task.status,
        detail: '${task.serviceName} · ${task.shoeCategory} · Qty ${task.quantity}',
      ),
    ).toList();
    final readyOrders = <String>{};
    for (final task in _tasks) {
      readyOrders.add(task.orderId);
    }
    final canMarkReady = readyOrders.where((orderId) {
      final orderTasks = _tasks.where((task) => task.orderId == orderId).toList();
      return orderTasks.isNotEmpty && orderTasks.every((task) => task.isCompleted);
    }).toList();

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
                    colors: [AppColors.navy, Color(0xFF124E4D)],
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
                        Text('${greeting()}, ${user?.firstName ?? 'operator'}',
                            style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12)),
                        const SizedBox(height: 6),
                        const Text('Cleaning queue',
                            style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        if (_initialLoading)
                          const SkeletonLine(width: 150)
                        else
                          Text('${active.length} active · ${completed.length} finished',
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
                        _tasks.isEmpty;
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
                        const SectionHeader(title: 'Assigned shoes'),
                        const SizedBox(height: 10),
                        if (loading)
                          const _TaskSkeleton()
                        else if (active.isEmpty)
                          const Card(
                            child: Padding(
                              padding: EdgeInsets.all(22),
                              child: Text('No cleaning tasks assigned right now.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(color: AppColors.muted, fontSize: 12)),
                            ),
                          )
                        else
                          for (final task in active)
                            _TaskCard(
                              task: task,
                              busy: _busy,
                              onStart: () => _setStatus(task, 'IN_PROGRESS'),
                              onComplete: () => _setStatus(task, 'COMPLETED'),
                            ),
                        if (!loading && canMarkReady.isNotEmpty) ...[
                          const SizedBox(height: 22),
                          const SectionHeader(title: 'Ready to dispatch'),
                          const SizedBox(height: 10),
                          for (final orderId in canMarkReady)
                            Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      _tasks.firstWhere((task) => task.orderId == orderId).bookingCode ?? orderId,
                                      style: const TextStyle(fontWeight: FontWeight.w800),
                                    ),
                                    const SizedBox(height: 6),
                                    const Text(
                                      'All shoes are clean. Marking ready notifies the delivery partner automatically.',
                                      style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4),
                                    ),
                                    const SizedBox(height: 12),
                                    FilledButton.icon(
                                      onPressed: _busy ? null : () => _markReady(orderId),
                                      icon: const Icon(Icons.check_circle_outline),
                                      label: const Text('Mark cleaning complete'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                        ],
                        if (!loading) ...[
                          const SizedBox(height: 22),
                          const SectionHeader(title: 'Finished'),
                          const SizedBox(height: 10),
                          for (final task in completed.take(8))
                            _TaskCard(task: task, busy: false, onStart: null, onComplete: null),
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

class _TaskCard extends StatelessWidget {
  final WashingTaskModel task;
  final bool busy;
  final VoidCallback? onStart;
  final VoidCallback? onComplete;

  const _TaskCard({
    required this.task,
    required this.busy,
    required this.onStart,
    required this.onComplete,
  });

  @override
  Widget build(BuildContext context) {
    final canStart = task.status == 'ASSIGNED' || task.status == 'PENDING';
    final canComplete = task.status == 'IN_PROGRESS';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.cleaning_services_rounded, color: AppColors.teal),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(task.serviceName,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
                StatusPill(status: task.status),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${task.shoeCategory} · Qty ${task.quantity} · ${task.bookingCode ?? task.orderId}',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            if (task.notes != null && task.notes!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(task.notes!, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
            ],
            if (canStart || canComplete) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  if (canStart)
                    Expanded(
                      child: FilledButton.tonal(
                        onPressed: busy ? null : onStart,
                        child: const Text('Start cleaning'),
                      ),
                    ),
                  if (canStart && canComplete) const SizedBox(width: 10),
                  if (canComplete)
                    Expanded(
                      child: FilledButton(
                        onPressed: busy ? null : onComplete,
                        child: const Text('Finish task'),
                      ),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: task.orderId)),
                ),
                child: const Text('View order'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskSkeleton extends StatelessWidget {
  const _TaskSkeleton();

  @override
  Widget build(BuildContext context) => const SkeletonCard(
        margin: EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                SkeletonBox(width: 18, height: 18, radius: 6),
                SizedBox(width: 10),
                SkeletonLine(width: 130),
                Spacer(),
                SkeletonBox(width: 76, height: 24, radius: 999),
              ],
            ),
            SizedBox(height: 14),
            SkeletonLine(width: 180),
            SizedBox(height: 16),
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
