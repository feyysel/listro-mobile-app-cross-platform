import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

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
        final color = Color.lerp(const Color(0xFFE8EBF1), const Color(0xFFF6F7FA), t)!;
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
