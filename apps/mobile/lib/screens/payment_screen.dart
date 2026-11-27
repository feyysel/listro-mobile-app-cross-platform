import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

class PaymentScreen extends StatefulWidget {
  final String orderId;
  final String kind;
  final double suggestedAmount;
  final String bookingCode;

  const PaymentScreen({
    super.key,
    required this.orderId,
    required this.kind,
    required this.suggestedAmount,
    required this.bookingCode,
  });

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _referenceController = TextEditingController();
  final _notesController = TextEditingController();
  String _method = 'TELEBIRR';
  bool _saving = false;
  String? _error;

  static const _methods = ['TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CARD', 'OTHER'];

  @override
  void initState() {
    super.initState();
    _amountController.text = widget.suggestedAmount.toStringAsFixed(0);
    _referenceController.text = 'LST-${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _amountController.dispose();
    _referenceController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ApiClient.instance.recordPayment(
        widget.orderId,
        amount: double.parse(_amountController.text),
        method: _method,
        kind: widget.kind,
        reference: _referenceController.text.trim(),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDeposit = widget.kind == 'DEPOSIT';
    return Scaffold(
      appBar: AppBar(title: Text(isDeposit ? 'Pay 50% deposit' : 'Pay final balance')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 30),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                  colors: [AppColors.navy, Color(0xFF273556)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.bookingCode,
                      style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12)),
                  const SizedBox(height: 8),
                  Text(
                    money(widget.suggestedAmount),
                    style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isDeposit
                        ? 'Pay at least half now. Your manager verifies the payment before confirming the order.'
                        : 'Pay the remaining balance after delivery. Your manager verifies the payment.',
                    style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            TextFormField(
              controller: _amountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Amount (ETB)'),
              validator: (value) {
                final amount = double.tryParse(value ?? '');
                if (amount == null || amount <= 0) return 'Enter a valid amount';
                if (isDeposit && amount + 0.01 < widget.suggestedAmount) {
                  return 'Deposit must be at least ${widget.suggestedAmount.toStringAsFixed(0)} ETB';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _method,
              decoration: const InputDecoration(labelText: 'Payment method'),
              items: [
                for (final method in _methods)
                  DropdownMenuItem(
                    value: method,
                    child: Text(method.replaceAll('_', ' ')),
                  ),
              ],
              onChanged: (value) => setState(() => _method = value ?? _methods.first),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _referenceController,
              decoration: const InputDecoration(
                labelText: 'Transaction reference',
                hintText: 'e.g. Telebirr receipt number',
              ),
              validator: (value) => (value == null || value.trim().isEmpty)
                  ? 'Enter the transaction reference'
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Notes (optional)'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(_error!, style: const TextStyle(color: AppColors.rose, fontSize: 12)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _submit,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(isDeposit ? 'Submit deposit' : 'Submit final payment'),
            ),
            const SizedBox(height: 12),
            const Text(
              'Listro never asks customers to claim payment success. A manager verifies your receipt and you will be notified.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }
}
