import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';

class BookingScreen extends StatefulWidget {
  final ServiceModel service;
  final List<AddressModel> addresses;

  const BookingScreen({super.key, required this.service, required this.addresses});

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _DraftItem {
  final category = TextEditingController(text: 'Sneakers');
  final brand = TextEditingController();
  final model = TextEditingController();
  final color = TextEditingController();
  final notes = TextEditingController();
  int quantity = 1;

  void dispose() {
    category.dispose();
    brand.dispose();
    model.dispose();
    color.dispose();
    notes.dispose();
  }
}

class _BookingScreenState extends State<BookingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _customerNotes = TextEditingController();
  final _addressLabel = TextEditingController(text: 'Home');
  final _addressLine = TextEditingController();
  final _city = TextEditingController(text: 'Dire Dawa');
  final _subCity = TextEditingController();
  final _phone = TextEditingController();
  List<AddressModel> _addresses = [];
  List<_DraftItem> _items = [_DraftItem()];
  String? _pickupAddressId;
  String? _returnAddressId;
  bool _showAddressForm = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _addresses = List<AddressModel>.from(widget.addresses);
    final preferred = _addresses.isEmpty
        ? null
        : (_addresses.where((address) => address.isDefault).firstOrNull ?? _addresses.first);
    _pickupAddressId = preferred?.id;
    _returnAddressId = preferred?.id;
    _showAddressForm = _addresses.isEmpty;
  }

  @override
  void dispose() {
    _customerNotes.dispose();
    _addressLabel.dispose();
    _addressLine.dispose();
    _city.dispose();
    _subCity.dispose();
    _phone.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  void _addItem() {
    setState(() => _items = [..._items, _DraftItem()]);
  }

  void _removeItem(int index) {
    if (_items.length == 1) return;
    final removed = _items.removeAt(index);
    removed.dispose();
    setState(() {});
  }

  Future<void> _saveAddress() async {
    if (_addressLine.text.trim().isEmpty || _city.text.trim().isEmpty) {
      setState(() => _error = 'Add an address line and city first.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final address = await ApiClient.instance.createAddress(
        label: _addressLabel.text.trim().isEmpty ? 'Home' : _addressLabel.text.trim(),
        addressLine: _addressLine.text.trim(),
        city: _city.text.trim(),
        subCity: _subCity.text.trim().isEmpty ? null : _subCity.text.trim(),
        phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        isDefault: _addresses.isEmpty,
      );
      setState(() {
        _addresses = [..._addresses, address];
        _pickupAddressId = address.id;
        _returnAddressId = address.id;
        _showAddressForm = false;
      });
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final pickup = _pickupAddressId;
    final returnAddress = _returnAddressId ?? pickup;
    if (pickup == null || returnAddress == null) {
      setState(() => _error = 'Choose a pickup and return address.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final created = await ApiClient.instance.createOrder(
        pickupAddressId: pickup,
        returnAddressId: returnAddress,
        customerNotes: _customerNotes.text.trim().isEmpty ? null : _customerNotes.text.trim(),
        items: _items
            .map(
              (item) => <String, dynamic>{
                'serviceId': widget.service.id,
                'shoeCategory': item.category.text.trim().isEmpty ? 'Sneakers' : item.category.text.trim(),
                if (item.brand.text.trim().isNotEmpty) 'shoeBrand': item.brand.text.trim(),
                if (item.model.text.trim().isNotEmpty) 'shoeModel': item.model.text.trim(),
                if (item.color.text.trim().isNotEmpty) 'shoeColor': item.color.text.trim(),
                if (item.notes.text.trim().isNotEmpty) 'conditionNotes': item.notes.text.trim(),
                'quantity': item.quantity,
              },
            )
            .toList(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(created);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final itemCount = _items.fold<int>(0, (total, item) => total + item.quantity);
    final estimated = widget.service.price * itemCount;

    return Scaffold(
      appBar: AppBar(title: const Text('Book a clean')),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(22),
                      gradient: const LinearGradient(
                        colors: [AppColors.navy, Color(0xFF263456)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(15),
                          ),
                          child: const Icon(Icons.auto_awesome, color: Colors.white),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.service.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                widget.service.description,
                                maxLines: 2,
                                style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 11, height: 1.4),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  const SectionHeader(title: 'Pickup & return'),
                  if (_addresses.isNotEmpty) ...[
                    DropdownButtonFormField<String>(
                      key: ValueKey(_pickupAddressId),
                      initialValue: _pickupAddressId,
                      decoration: const InputDecoration(labelText: 'Pickup address'),
                      items: [
                        for (final address in _addresses)
                          DropdownMenuItem(value: address.id, child: Text(address.shortAddress)),
                      ],
                      onChanged: (value) => setState(() => _pickupAddressId = value),
                      validator: (value) => value == null || value.isEmpty ? 'Choose an address' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      key: ValueKey(_returnAddressId),
                      initialValue: _returnAddressId,
                      decoration: const InputDecoration(labelText: 'Return address'),
                      items: [
                        for (final address in _addresses)
                          DropdownMenuItem(value: address.id, child: Text(address.shortAddress)),
                      ],
                      onChanged: (value) => setState(() => _returnAddressId = value),
                      validator: (value) => value == null || value.isEmpty ? 'Choose an address' : null,
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setState(() => _showAddressForm = !_showAddressForm),
                        icon: const Icon(Icons.add_location_alt_rounded, size: 18),
                        label: Text(_showAddressForm ? 'Hide new address' : 'Add a new address'),
                      ),
                    ),
                  ],
                  if (_showAddressForm) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          children: [
                            TextFormField(
                              controller: _addressLabel,
                              decoration: const InputDecoration(labelText: 'Address label'),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _addressLine,
                              decoration: const InputDecoration(labelText: 'Street address'),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: _city,
                                    decoration: const InputDecoration(labelText: 'City'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: TextFormField(
                                    controller: _subCity,
                                    decoration: const InputDecoration(labelText: 'Sub-city'),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ElevatedButton(
                              onPressed: _saving ? null : _saveAddress,
                              child: const Text('Save address'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 22),
                  Row(
                    children: [
                      const Expanded(
                        child: Text('Shoes', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                      ),
                      FilledButton.tonal(
                        onPressed: _addItem,
                        child: const Text('Add item'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  for (var index = 0; index < _items.length; index++)
                    _ShoeItemCard(
                      item: _items[index],
                      index: index,
                      canRemove: _items.length > 1,
                      onRemove: () => _removeItem(index),
                      onQuantityChanged: (value) {
                        setState(() => _items[index].quantity = value);
                      },
                    ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _customerNotes,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Notes for the care team (optional)',
                      alignLabelWithHint: true,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: AppColors.rose, fontSize: 12)),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Color(0x140B1220), blurRadius: 18, offset: Offset(0, -6))],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text('$itemCount item(s)', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      const Spacer(),
                      Text(money(estimated), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _saving ? null : _submit,
                    child: _saving
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text('Place order'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShoeItemCard extends StatelessWidget {
  final _DraftItem item;
  final int index;
  final bool canRemove;
  final VoidCallback onRemove;
  final ValueChanged<int> onQuantityChanged;

  const _ShoeItemCard({
    required this.item,
    required this.index,
    required this.canRemove,
    required this.onRemove,
    required this.onQuantityChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                Text('Item ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                if (canRemove)
                  IconButton(
                    onPressed: onRemove,
                    icon: const Icon(Icons.delete_outline_rounded, color: AppColors.rose, size: 20),
                  ),
              ],
            ),
            TextFormField(
              controller: item.category,
              decoration: const InputDecoration(labelText: 'Shoe category'),
              validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: item.brand,
                    decoration: const InputDecoration(labelText: 'Brand'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: item.model,
                    decoration: const InputDecoration(labelText: 'Model'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: item.color,
                    decoration: const InputDecoration(labelText: 'Color'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Quantity'),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: item.quantity,
                        isDense: true,
                        items: List<int>.generate(10, (index) => index + 1)
                            .map((value) => DropdownMenuItem<int>(value: value, child: Text('$value')))
                            .toList(),
                        onChanged: (value) {
                          if (value != null) onQuantityChanged(value);
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: item.notes,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Condition notes (optional)'),
            ),
          ],
        ),
      ),
    );
  }
}
