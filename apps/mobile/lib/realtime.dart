import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api.dart';

class RealtimeEvent {
  final String type;
  final Map<String, dynamic> data;

  const RealtimeEvent({required this.type, required this.data});

  String? get orderId {
    final nested = data['data'];
    if (nested is Map<String, dynamic>) return nested['orderId']?.toString();
    return data['orderId']?.toString();
  }
}

class RealtimeClient {
  RealtimeClient._();

  static final RealtimeClient instance = RealtimeClient._();

  final StreamController<RealtimeEvent> _controller =
      StreamController<RealtimeEvent>.broadcast();

  Stream<RealtimeEvent> get events => _controller.stream;

  bool _running = false;
  http.Client? _client;

  void start() {
    if (_running || !ApiClient.instance.isSignedIn) return;
    _running = true;
    unawaited(_listen());
  }

  void stop() {
    _running = false;
    _client?.close();
    _client = null;
  }

  Future<void> _listen() async {
    while (_running && ApiClient.instance.isSignedIn) {
      final token = ApiClient.instance.token;
      if (token == null || token.isEmpty) {
        await Future<void>.delayed(const Duration(seconds: 2));
        continue;
      }

      final client = http.Client();
      _client = client;
      try {
        final request = http.Request(
          'GET',
          Uri.parse('${ApiClient.baseUrl}/events'),
        )..headers.addAll(<String, String>{
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer $token',
          });

        final response = await client.send(request);
        if (response.statusCode == 401) {
          await ApiClient.instance.refreshSession();
          continue;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) continue;

        var eventType = 'message';
        final dataLines = <String>[];
        final lines = response.stream
            .transform(utf8.decoder)
            .transform(const LineSplitter());

        await for (final line in lines) {
          if (!_running) break;
          if (line.isEmpty) {
            if (dataLines.isNotEmpty) _emit(eventType, dataLines.join('\n'));
            eventType = 'message';
            dataLines.clear();
            continue;
          }
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.add(line.substring(5).trimLeft());
          }
        }
      } catch (_) {
      } finally {
        client.close();
        if (identical(_client, client)) _client = null;
      }

      if (_running) {
        await Future<void>.delayed(const Duration(seconds: 2));
      }
    }
  }

  void _emit(String type, String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return;
      if (_controller.isClosed) return;
      _controller.add(RealtimeEvent(type: type, data: decoded));
    } catch (_) {}
  }
}
