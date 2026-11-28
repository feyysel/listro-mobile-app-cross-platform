import 'dart:async';

import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../realtime.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<void> _loading;
  List<AppNotification> _items = [];
  String? _error;
  StreamSubscription<RealtimeEvent>? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _loading = _load();
    _realtimeSub = RealtimeClient.instance.events.listen((event) {
      if (event.type == 'notification') _load();
    });
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await ApiClient.instance.notifications();
      if (!mounted) return;
      setState(() {
        _items = items;
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _markAll() async {
    try {
      await ApiClient.instance.markAllNotificationsRead();
      await _load();
    } catch (error) {
      setState(() => _error = error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = _items.where((item) => !item.isRead).length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Updates'),
        actions: [
          if (unread > 0)
            TextButton(onPressed: _markAll, child: const Text('Mark all read')),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: FutureBuilder<void>(
          future: _loading,
          builder: (context, snapshot) {
            final loading = snapshot.connectionState == ConnectionState.waiting && _items.isEmpty;
            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
              children: [
                if (_error != null)
                  InlineError(
                    message: _error!,
                    onRetry: () => setState(() => _loading = _load()),
                  ),
                if (loading)
                  for (var index = 0; index < 6; index++)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 10),
                      child: _NotificationSkeleton(),
                    ),
                if (!loading && _items.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(28),
                      child: Column(
                        children: [
                          Icon(Icons.notifications_none_rounded,
                              size: 46, color: AppColors.primary),
                          SizedBox(height: 12),
                          Text('You’re all caught up',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                          SizedBox(height: 6),
                          Text('Order updates will land here.',
                              style: TextStyle(color: AppColors.muted, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                if (!loading)
                  for (final item in _items)
                    Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: ListTile(
                        onTap: () async {
                          if (!item.isRead) {
                            try {
                              await ApiClient.instance.markNotificationRead(item.id);
                              setState(() => item.isRead = true);
                            } catch (error) {
                              setState(() => _error = error.toString());
                            }
                          }
                          final orderId = item.orderId;
                          if (orderId == null || !context.mounted) return;
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => OrderDetailScreen(orderId: orderId),
                            ),
                          );
                        },
                        leading: CircleAvatar(
                          backgroundColor: item.isRead
                              ? const Color(0xFFF0F1F5)
                              : AppColors.primary.withValues(alpha: 0.12),
                          child: Icon(
                            item.isRead ? Icons.mark_email_read_rounded : Icons.circle,
                            color: AppColors.primary,
                            size: item.isRead ? 20 : 10,
                          ),
                        ),
                        title: Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '${item.message}\n${_time(item.createdAt)}',
                            style: const TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4),
                          ),
                        ),
                        trailing: item.orderId == null
                            ? null
                            : const Icon(Icons.chevron_right_rounded, color: AppColors.primary),
                        isThreeLine: true,
                      ),
                    ),
              ],
            );
          },
        ),
      ),
    );
  }

  String _time(DateTime value) {
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '${value.day}/${value.month} · $hour:$minute';
  }
}

class _NotificationSkeleton extends StatelessWidget {
  const _NotificationSkeleton();

  @override
  Widget build(BuildContext context) => const SkeletonCard(
        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            SkeletonAvatar(size: 40),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonLine(width: 120),
                  SizedBox(height: 8),
                  SkeletonLine(width: double.infinity),
                  SizedBox(height: 6),
                  SkeletonLine(width: 180),
                ],
              ),
            ),
          ],
        ),
      );
}
