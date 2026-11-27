import 'package:flutter_test/flutter_test.dart';
import 'package:listro_mobile/models.dart';
import 'package:listro_mobile/widgets.dart';

void main() {
  test('service model reads branch price', () {
    final service = ServiceModel.fromJson({
      'id': 'svc_1',
      'name': 'Deep Clean',
      'description': 'A thorough clean',
      'estimatedDurationMinutes': 45,
      'branchServices': [
        {'price': '1250.00'},
      ],
    });

    expect(service.name, 'Deep Clean');
    expect(service.price, 1250);
    expect(service.durationMinutes, 45);
  });

  test('order model reads detailed items and history', () {
    final order = OrderModel.fromJson(
      {
        'id': 'ord_1',
        'bookingCode': 'LST-1001',
        'status': 'CONFIRMED',
        'totalAmount': '2500.00',
        'currency': 'ETB',
        'placedAt': '2026-11-24T10:30:00.000Z',
        'branch': {'name': 'Dire Dawa'},
        'customer': {
          'user': {'firstName': 'Dawa', 'lastName': 'Tesfaye'},
        },
        'items': [
          {
            'serviceName': 'Deep Clean',
            'shoeCategory': 'Sneakers',
            'quantity': 2,
            'totalPrice': '2500.00',
          },
        ],
        'statusHistory': [
          {
            'newStatus': 'PLACED',
            'note': null,
            'createdAt': '2026-11-24T10:30:00.000Z',
          },
        ],
      },
      detailed: true,
    );

    expect(order.bookingCode, 'LST-1001');
    expect(order.branchName, 'Dire Dawa');
    expect(order.customerName, 'Dawa Tesfaye');
    expect(order.itemCount, 1);
    expect(order.items.single.shoeCategory, 'Sneakers');
    expect(order.statusHistory.single.status, 'PLACED');
  });

  test('money formats ETB amounts', () {
    expect(money(1250), 'ETB 1,250');
  });
}
