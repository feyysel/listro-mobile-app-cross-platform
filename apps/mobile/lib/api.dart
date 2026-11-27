import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class ApiException implements Exception {
  final String message;
  final int statusCode;

  ApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://listro-mobile-app-cross-platform.vercel.app/api/v1',
  );

  String? _token;
  SessionUser? _user;

  String? get token => _token;
  SessionUser? get user => _user;
  bool get isSignedIn => _token != null && _token!.isNotEmpty;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('listro_token');
    final userJson = prefs.getString('listro_user');
    if (userJson != null && userJson.isNotEmpty) {
      try {
        _user = SessionUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
      } catch (_) {
        _user = null;
      }
    }
  }

  Future<void> _saveSession(String token, dynamic user) async {
    _token = token;
    if (user is Map<String, dynamic>) {
      _user = SessionUser.fromJson(user['user'] is Map<String, dynamic>
          ? user['user'] as Map<String, dynamic>
          : user);
    } else {
      _user = null;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('listro_token', token);
    if (_user != null) await prefs.setString('listro_user', jsonEncode(_user!.toJson()));
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('listro_token');
    await prefs.remove('listro_user');
  }

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Map<String, String> _headers({bool authenticated = true}) {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (authenticated && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } catch (_) {
      return response.body;
    }
  }

  String _message(dynamic decoded, int statusCode) {
    if (decoded is Map<String, dynamic>) {
      final message = decoded['message'];
      if (message is List) return message.join(', ');
      if (message != null) return message.toString();
    }
    return 'Request failed ($statusCode)';
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    bool authenticated = true,
  }) async {
    final request = http.Request(method, _uri(path))
      ..headers.addAll(_headers(authenticated: authenticated));
    if (body != null) request.body = jsonEncode(body);
    final streamed = await request.send().timeout(const Duration(seconds: 20));
    final response = await http.Response.fromStream(streamed);

    final decoded = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401) await logout();
      throw ApiException(_message(decoded, response.statusCode), response.statusCode);
    }
    return decoded;
  }

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, Object body) => _request('POST', path, body: body);
  Future<dynamic> patch(String path, Object body) => _request('PATCH', path, body: body);

  Future<void> login(String email, String password) async {
    final result = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
      authenticated: false,
    ) as Map<String, dynamic>;
    await _saveSession(result['accessToken'] as String, result);
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
  }) async {
    final result = await _request(
      'POST',
      '/auth/register',
      body: {
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'phone': phone,
        'password': password,
      },
      authenticated: false,
    ) as Map<String, dynamic>;
    await _saveSession(result['accessToken'] as String, result);
  }

  Future<List<ServiceModel>> services() async {
    final result = await get('/services') as List<dynamic>;
    return result
        .map((item) => ServiceModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<AddressModel>> addresses() async {
    final result = await get('/addresses') as List<dynamic>;
    return result
        .map((item) => AddressModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<OrderModel>> orders({String? search, String? status}) async {
    final query = <String, String>{'limit': '100'};
    if (search != null && search.trim().isNotEmpty) {
      query['search'] = Uri.encodeComponent(search.trim());
    }
    if (status != null && status.isNotEmpty) query['status'] = status;
    final queryString = query.entries.map((entry) => '${entry.key}=${entry.value}').join('&');
    final result = await get('/orders?$queryString') as Map<String, dynamic>;
    final items = result['items'] as List<dynamic>? ?? [];
    return items
        .map((item) => OrderModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<OrderModel> order(String id) async {
    final result = await get('/orders/$id') as Map<String, dynamic>;
    return OrderModel.fromJson(result, detailed: true);
  }

  Future<OrderModel> createOrder({
    required String pickupAddressId,
    required String returnAddressId,
    required List<Map<String, dynamic>> items,
    String? customerNotes,
  }) async {
    final result = await post('/orders', {
      'pickupAddressId': pickupAddressId,
      'returnAddressId': returnAddressId,
      'items': items,
      if (customerNotes != null && customerNotes.isNotEmpty) 'customerNotes': customerNotes,
    }) as Map<String, dynamic>;
    return order(result['id'] as String);
  }

  Future<void> cancelOrder(String id, String reason) async {
    await post('/orders/$id/cancel', {'reason': reason});
  }

  Future<AddressModel> createAddress({
    required String label,
    required String addressLine,
    required String city,
    String? subCity,
    String? phone,
    bool isDefault = false,
  }) async {
    final result = await post('/addresses', {
      'label': label,
      'addressLine': addressLine,
      'city': city,
      if (subCity != null && subCity.isNotEmpty) 'subCity': subCity,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'isDefault': isDefault,
    }) as Map<String, dynamic>;
    return AddressModel.fromJson(result);
  }

  Future<void> confirmOrder(String id, {String? reason}) async {
    await post('/orders/$id/confirm', {if (reason != null) 'reason': reason});
  }

  Future<void> rejectOrder(String id, String reason) async {
    await post('/orders/$id/reject', {'reason': reason});
  }

  Future<PaymentRequirements> paymentRequirements(String orderId) async {
    final result = await get('/orders/$orderId/payment-requirements') as Map<String, dynamic>;
    return PaymentRequirements.fromJson(result);
  }

  Future<List<PaymentModel>> payments(String orderId) async {
    final result = await get('/orders/$orderId/payments') as List<dynamic>;
    return result.map((item) => PaymentModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<PaymentModel> recordPayment(
    String orderId, {
    required double amount,
    required String method,
    required String kind,
    required String reference,
    String? notes,
  }) async {
    final result = await post('/orders/$orderId/payments', {
      'amount': amount,
      'method': method,
      'kind': kind,
      'transactionReference': reference,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    }) as Map<String, dynamic>;
    return PaymentModel.fromJson(result);
  }

  Future<void> verifyPayment(String paymentId) async {
    await post('/payments/$paymentId/verify', {'status': 'COMPLETED'});
  }

  Future<RatingModel?> rating(String orderId) async {
    final result = await get('/orders/$orderId/rating');
    if (result == null) return null;
    return RatingModel.fromJson(result as Map<String, dynamic>);
  }

  Future<RatingModel> submitRating(String orderId, int score, String? comment) async {
    final result = await post('/orders/$orderId/rating', {
      'score': score,
      if (comment != null && comment.isNotEmpty) 'comment': comment,
    }) as Map<String, dynamic>;
    return RatingModel.fromJson(result);
  }

  Future<List<DeliveryModel>> myDeliveries() async {
    final result = await get('/deliveries/my') as List<dynamic>;
    return result.map((item) => DeliveryModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<DeliveryModel>> orderDeliveries(String orderId) async {
    final result = await get('/orders/$orderId/deliveries') as List<dynamic>;
    return result.map((item) => DeliveryModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> updateDeliveryStatus(
    String deliveryId,
    String status, {
    String? notes,
    String? reason,
  }) async {
    await patch('/deliveries/$deliveryId/status', {
      'status': status,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      if (reason != null && reason.isNotEmpty) 'reason': reason,
    });
  }

  Future<DeliveryModel> assignPickup(String orderId, String employeeId) async {
    final result = await post('/orders/$orderId/deliveries/pickup', {'employeeId': employeeId})
        as Map<String, dynamic>;
    return DeliveryModel.fromJson(result);
  }

  Future<DeliveryModel> createReturn(String orderId, {String? employeeId}) async {
    final result = await post('/orders/$orderId/deliveries/return', {
      if (employeeId != null) 'employeeId': employeeId,
    }) as Map<String, dynamic>;
    return DeliveryModel.fromJson(result);
  }

  Future<List<WashingTaskModel>> myTasks() async {
    final result = await get('/washing-tasks/my') as List<dynamic>;
    return result.map((item) => WashingTaskModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<List<WashingTaskModel>> centerTasks() async {
    final result = await get('/washing-tasks/center') as List<dynamic>;
    return result.map((item) => WashingTaskModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<void> assignTask(String taskId, String operatorId) async {
    await post('/washing-tasks/$taskId/assign', {'operatorId': operatorId});
  }

  Future<void> updateTaskStatus(String taskId, String status, {String? notes}) async {
    await patch('/washing-tasks/$taskId/status', {
      'status': status,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<void> markOrderReady(String orderId) async {
    await post('/orders/$orderId/ready', {});
  }

  Future<List<EmployeeModel>> employees({String? role}) async {
    final result = await get('/employees?limit=100${role == null ? '' : '&role=$role'}')
        as Map<String, dynamic>;
    final items = result['items'] as List<dynamic>? ?? [];
    return items.map((item) => EmployeeModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  Future<int> unreadCount() async {
    final result = await get('/notifications?limit=1') as Map<String, dynamic>;
    return int.tryParse(result['unreadCount']?.toString() ?? '0') ?? 0;
  }

  Future<List<AppNotification>> notifications() async {
    final result = await get('/notifications?limit=30') as Map<String, dynamic>;
    final items = result['items'] as List<dynamic>? ?? [];
    return items
        .map((item) => AppNotification.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> markNotificationRead(String id) async {
    await _request('PATCH', '/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _request('PATCH', '/notifications/read-all');
  }
}
