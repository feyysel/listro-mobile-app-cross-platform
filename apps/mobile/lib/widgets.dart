import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'roles.dart';
import 'theme.dart';

class StatusPill extends StatelessWidget {
  final String status;

  const StatusPill({super.key, required this.status});

  Color get _color {
    switch (status) {
      case 'DELIVERED':
      case 'COMPLETED':
      case 'READY_FOR_DELIVERY':
        return AppColors.green;
      case 'CANCELLED':
      case 'REJECTED':
      case 'FAILED':
        return AppColors.rose;
      case 'WASHING_IN_PROGRESS':
      case 'PICKUP_IN_PROGRESS':
      case 'OUT_FOR_DELIVERY':
        return AppColors.secondary;
      case 'RECEIVED_AT_CENTER':
      case 'WASHING_COMPLETED':
        return AppColors.teal;
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = status.replaceAll('_', ' ').toLowerCase();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label[0].toUpperCase() + label.substring(1),
        style: TextStyle(color: _color, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class LiveOrderItem {
  final String orderId;
  final String code;
  final String status;
  final String detail;
  final DateTime? placedAt;
  final double? amount;
  final String currency;

  const LiveOrderItem({
    required this.orderId,
    required this.code,
    required this.status,
    required this.detail,
    this.placedAt,
    this.amount,
    this.currency = 'ETB',
  });
}

class LiveOrderCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<LiveOrderItem> items;
  final ValueChanged<String> onTap;
  final VoidCallback? onSeeAll;

  const LiveOrderCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.items,
    required this.onTap,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 18),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: colors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(Icons.radar_rounded, color: colors.primary, size: 18),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(color: colors.onSurface.withValues(alpha: 0.6), fontSize: 11),
                      ),
                    ],
                  ),
                ),
                if (onSeeAll != null)
                  TextButton(onPressed: onSeeAll, child: const Text('See all')),
              ],
            ),
            const SizedBox(height: 12),
            if (items.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 20),
                decoration: BoxDecoration(
                  color: colors.onSurface.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  'No live orders need attention right now.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colors.onSurface.withValues(alpha: 0.6), fontSize: 12),
                ),
              )
            else
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _LiveOrderRow(item: item, onTap: () => onTap(item.orderId)),
                ),
          ],
        ),
      ),
    );
  }
}

class _LiveOrderRow extends StatelessWidget {
  final LiveOrderItem item;
  final VoidCallback onTap;

  const _LiveOrderRow({required this.item, required this.onTap});

  IconData get _icon {
    final value = item.status;
    if (value.contains('DELIVERY') || value.contains('PICKUP') || value.contains('OUT_FOR')) {
      return Icons.local_shipping_rounded;
    }
    if (value.contains('WASH') || value.contains('RECEIVED')) {
      return Icons.cleaning_services_rounded;
    }
    return Icons.receipt_long_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Material(
      color: colors.onSurface.withValues(alpha: 0.03),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(_icon, color: colors.primary, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item.code,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  StatusPill(status: item.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                item.detail,
                style: TextStyle(color: colors.onSurface.withValues(alpha: 0.62), fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: workflowProgress(item.status),
                  minHeight: 5,
                  backgroundColor: colors.onSurface.withValues(alpha: 0.08),
                  color: colors.primary,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (item.placedAt != null)
                    Expanded(
                      child: Text(
                        shortDate(item.placedAt!),
                        style: TextStyle(color: colors.onSurface.withValues(alpha: 0.55), fontSize: 10),
                      ),
                    )
                  else
                    const Spacer(),
                  if (item.amount != null)
                    Text(
                      money(item.amount!, currency: item.currency),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;

  const SectionHeader({super.key, required this.title, this.action, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800, letterSpacing: -0.4),
          ),
        ),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    );
  }
}

class SkeletonBox extends StatefulWidget {
  final double width;
  final double height;
  final double radius;

  const SkeletonBox({
    super.key,
    this.width = double.infinity,
    this.height = 12,
    this.radius = 8,
  });

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = Curves.easeInOut.transform(_controller.value);
        final dark = Theme.of(context).brightness == Brightness.dark;
        final color = Color.lerp(
          dark ? const Color(0xFF1B2436) : const Color(0xFFE8EBF1),
          dark ? const Color(0xFF27314A) : const Color(0xFFF6F7FA),
          t,
        )!;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        );
      },
    );
  }
}

class SkeletonLine extends StatelessWidget {
  final double width;

  const SkeletonLine({super.key, this.width = double.infinity});

  @override
  Widget build(BuildContext context) => SkeletonBox(width: width, height: 12);
}

class SkeletonAvatar extends StatelessWidget {
  final double size;

  const SkeletonAvatar({super.key, this.size = 44});

  @override
  Widget build(BuildContext context) => SkeletonBox(
        width: size,
        height: size,
        radius: size / 2,
      );
}

class SkeletonCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  const SkeletonCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
  });

  @override
  Widget build(BuildContext context) => Card(
        margin: margin,
        child: Padding(padding: padding, child: child),
      );
}

class InlineError extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const InlineError({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.rose.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.rose, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: AppColors.rose, fontSize: 11, height: 1.3),
              ),
            ),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}

String money(double value, {String currency = 'ETB'}) {
  final formatter = NumberFormat('#,##0', 'en_US');
  return '$currency ${formatter.format(value)}';
}

String shortDate(DateTime value) {
  return DateFormat('d MMM · HH:mm').format(value);
}

String greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
