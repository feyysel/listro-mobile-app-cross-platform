class SessionUser {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String role;
  final String? customerId;
  final String? employeeId;
  final List<String> branchIds;

  SessionUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    this.customerId,
    this.employeeId,
    this.branchIds = const [],
  });

  String get fullName => '$firstName $lastName'.trim();

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    return SessionUser(
      id: json['id'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? 'CUSTOMER',
      customerId: json['customerId'] as String?,
      employeeId: json['employeeId'] as String?,
      branchIds: (json['branchIds'] as List<dynamic>? ?? [])
          .map((value) => value.toString())
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'role': role,
        'customerId': customerId,
        'employeeId': employeeId,
        'branchIds': branchIds,
      };
}

class ServiceModel {
  final String id;
  final String name;
  final String description;
  final int? durationMinutes;
  final double price;

  ServiceModel({
    required this.id,
    required this.name,
    required this.description,
    required this.durationMinutes,
    required this.price,
  });

  factory ServiceModel.fromJson(Map<String, dynamic> json) {
    final branches = (json['branchServices'] as List<dynamic>? ?? []);
    final first = branches.isNotEmpty ? branches.first as Map<String, dynamic> : null;
    return ServiceModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Service',
      description: json['description'] as String? ?? '',
      durationMinutes: json['estimatedDurationMinutes'] as int?,
      price: double.tryParse(first?['price']?.toString() ?? '0') ?? 0,
    );
  }
}

class AddressModel {
  final String id;
  final String label;
  final String addressLine;
  final String city;
  final String subCity;
  final String phone;
  final bool isDefault;

  AddressModel({
    required this.id,
    required this.label,
    required this.addressLine,
    required this.city,
    required this.subCity,
    required this.phone,
    required this.isDefault,
  });

  String get shortAddress => '$addressLine, $city';

  factory AddressModel.fromJson(Map<String, dynamic> json) {
    return AddressModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? 'Address',
      addressLine: json['addressLine'] as String? ?? '',
      city: json['city'] as String? ?? '',
      subCity: json['subCity'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }
}

class OrderModel {
  final String id;
  final String bookingCode;
  final String status;
  final double totalAmount;
  final String currency;
  final DateTime placedAt;
  final DateTime? completedAt;
  final String customerName;
  final String branchName;
  final int itemCount;
  final List<OrderItemModel> items;
  final List<StatusEvent> statusHistory;
  final List<PaymentModel> payments;

  OrderModel({
    required this.id,
    required this.bookingCode,
    required this.status,
    required this.totalAmount,
    required this.currency,
    required this.placedAt,
    this.completedAt,
    required this.customerName,
    required this.branchName,
    required this.itemCount,
    this.items = const [],
    this.statusHistory = const [],
    this.payments = const [],
  });

  factory OrderModel.fromJson(Map<String, dynamic> json, {bool detailed = false}) {
    final customer = json['customer'] as Map<String, dynamic>? ?? {};
    final customerUser = customer['user'] as Map<String, dynamic>? ?? {};
    final branch = json['branch'] as Map<String, dynamic>? ?? {};
    final count = json['_count'] as Map<String, dynamic>? ?? {};
    final rawItems = json['items'] as List<dynamic>? ?? [];
    final rawHistory = json['statusHistory'] as List<dynamic>? ?? [];
    final rawPayments = json['payments'] as List<dynamic>? ?? [];

    return OrderModel(
      id: json['id'] as String? ?? '',
      bookingCode: json['bookingCode'] as String? ?? '',
      status: json['status'] as String? ?? 'PLACED',
      totalAmount: double.tryParse(json['totalAmount']?.toString() ?? '0') ?? 0,
      currency: json['currency'] as String? ?? 'ETB',
      placedAt: DateTime.tryParse(json['placedAt']?.toString() ?? '') ?? DateTime.now(),
      completedAt: DateTime.tryParse(json['completedAt']?.toString() ?? ''),
      customerName:
          '${customerUser['firstName'] ?? ''} ${customerUser['lastName'] ?? ''}'.trim(),
      branchName: branch['name'] as String? ?? 'Branch assignment pending',
      itemCount: count['items'] == null
          ? rawItems.length
          : int.tryParse(count['items'].toString()) ?? rawItems.length,
      items: detailed
          ? rawItems.map((item) => OrderItemModel.fromJson(item as Map<String, dynamic>)).toList()
          : const [],
      statusHistory: detailed
          ? rawHistory.map((event) => StatusEvent.fromJson(event as Map<String, dynamic>)).toList()
          : const [],
      payments: rawPayments
          .map((payment) => PaymentModel.fromJson(payment as Map<String, dynamic>))
          .toList(),
    );
  }
}

class OrderItemModel {
  final String serviceName;
  final String shoeCategory;
  final int quantity;
  final double totalPrice;

  OrderItemModel({
    required this.serviceName,
    required this.shoeCategory,
    required this.quantity,
    required this.totalPrice,
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    return OrderItemModel(
      serviceName: json['serviceName'] as String? ?? 'Cleaning service',
      shoeCategory: json['shoeCategory'] as String? ?? 'Shoes',
      quantity: int.tryParse(json['quantity']?.toString() ?? '1') ?? 1,
      totalPrice: double.tryParse(json['totalPrice']?.toString() ?? '0') ?? 0,
    );
  }
}

class StatusEvent {
  final String status;
  final String? note;
  final DateTime createdAt;

  StatusEvent({required this.status, required this.note, required this.createdAt});

  factory StatusEvent.fromJson(Map<String, dynamic> json) {
    return StatusEvent(
      status: json['newStatus'] as String? ?? 'PLACED',
      note: json['note'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

class AppNotification {
  final String id;
  final String title;
  final String message;
  bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic> data;

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
    this.data = const {},
  });

  String? get orderId => data['orderId']?.toString();

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Update',
      message: json['message'] as String? ?? '',
      isRead: json['isRead'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      data: json['data'] is Map<String, dynamic>
          ? json['data'] as Map<String, dynamic>
          : const {},
    );
  }
}

class PaymentModel {
  final String id;
  final String orderId;
  final String kind;
  final String method;
  final String status;
  final double amount;
  final String? reference;
  final DateTime createdAt;

  PaymentModel({
    required this.id,
    required this.orderId,
    required this.kind,
    required this.method,
    required this.status,
    required this.amount,
    this.reference,
    required this.createdAt,
  });

  bool get isDeposit => kind == 'DEPOSIT';
  bool get isCompleted => status == 'COMPLETED';

  factory PaymentModel.fromJson(Map<String, dynamic> json) => PaymentModel(
        id: json['id'] as String? ?? '',
        orderId: json['orderId'] as String? ?? '',
        kind: json['kind'] as String? ?? 'DEPOSIT',
        method: json['method'] as String? ?? 'OTHER',
        status: json['status'] as String? ?? 'PENDING',
        amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0,
        reference: json['transactionReference'] as String?,
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      );
}

class PaymentRequirements {
  final double total;
  final double depositRequired;
  final double depositPaid;
  final double depositMissing;
  final double outstanding;
  final bool depositComplete;
  final bool fullyPaid;
  final String status;

  PaymentRequirements({
    required this.total,
    required this.depositRequired,
    required this.depositPaid,
    required this.depositMissing,
    required this.outstanding,
    required this.depositComplete,
    required this.fullyPaid,
    required this.status,
  });

  factory PaymentRequirements.fromJson(Map<String, dynamic> json) => PaymentRequirements(
        total: double.tryParse(json['total']?.toString() ?? '0') ?? 0,
        depositRequired: double.tryParse(json['depositRequired']?.toString() ?? '0') ?? 0,
        depositPaid: double.tryParse(json['depositPaid']?.toString() ?? '0') ?? 0,
        depositMissing: double.tryParse(json['depositMissing']?.toString() ?? '0') ?? 0,
        outstanding: double.tryParse(json['outstanding']?.toString() ?? '0') ?? 0,
        depositComplete: json['depositComplete'] as bool? ?? false,
        fullyPaid: json['fullyPaid'] as bool? ?? false,
        status: json['status'] as String? ?? 'PLACED',
      );
}

class DeliveryModel {
  final String id;
  final String orderId;
  final String type;
  final String status;
  final String? addressLine;
  final String? city;
  final OrderModel? order;
  final String? assigneeName;

  DeliveryModel({
    required this.id,
    required this.orderId,
    required this.type,
    required this.status,
    this.addressLine,
    this.city,
    this.order,
    this.assigneeName,
  });

  bool get isPickup => type == 'PICKUP';
  bool get isDone => status == 'COMPLETED';

  String get location => [addressLine, city].where((value) => value != null && value.isNotEmpty).join(', ');

  factory DeliveryModel.fromJson(Map<String, dynamic> json) {
    final address = json['address'] as Map<String, dynamic>?;
    final employee = json['employee'] as Map<String, dynamic>?;
    final employeeUser = employee?['user'] as Map<String, dynamic>?;
    final order = json['order'] as Map<String, dynamic>?;
    return DeliveryModel(
      id: json['id'] as String? ?? '',
      orderId: json['orderId'] as String? ?? '',
      type: json['type'] as String? ?? 'PICKUP',
      status: json['status'] as String? ?? 'PENDING',
      addressLine: address?['addressLine'] as String?,
      city: address?['city'] as String?,
      order: order == null ? null : OrderModel.fromJson(order),
      assigneeName: employeeUser == null
          ? null
          : '${employeeUser['firstName'] ?? ''} ${employeeUser['lastName'] ?? ''}'.trim(),
    );
  }
}

class WashingTaskModel {
  final String id;
  final String orderId;
  final String status;
  final String serviceName;
  final String shoeCategory;
  final int quantity;
  final String? notes;
  final String? bookingCode;

  WashingTaskModel({
    required this.id,
    required this.orderId,
    required this.status,
    required this.serviceName,
    required this.shoeCategory,
    required this.quantity,
    this.notes,
    this.bookingCode,
  });

  bool get isCompleted => status == 'COMPLETED';

  factory WashingTaskModel.fromJson(Map<String, dynamic> json) {
    final item = json['orderItem'] as Map<String, dynamic>? ?? {};
    final order = json['order'] as Map<String, dynamic>? ?? {};
    return WashingTaskModel(
      id: json['id'] as String? ?? '',
      orderId: json['orderId'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      serviceName: item['serviceName'] as String? ?? 'Cleaning service',
      shoeCategory: item['shoeCategory'] as String? ?? 'Shoes',
      quantity: int.tryParse(item['quantity']?.toString() ?? '1') ?? 1,
      notes: json['notes'] as String?,
      bookingCode: order['bookingCode'] as String?,
    );
  }
}

class EmployeeModel {
  final String id;
  final String name;
  final String role;

  EmployeeModel({required this.id, required this.name, required this.role});

  factory EmployeeModel.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    return EmployeeModel(
      id: json['id'] as String? ?? '',
      name: '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim(),
      role: user['role'] as String? ?? 'EMPLOYEE',
    );
  }
}

class RatingModel {
  final int score;
  final String? comment;

  RatingModel({required this.score, this.comment});

  factory RatingModel.fromJson(Map<String, dynamic> json) => RatingModel(
        score: int.tryParse(json['score']?.toString() ?? '0') ?? 0,
        comment: json['comment'] as String?,
      );
}
