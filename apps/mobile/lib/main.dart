import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/splash_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient.instance.init();
  runApp(const ListroApp());
}

class ListroApp extends StatelessWidget {
  const ListroApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Listro',
      theme: AppTheme.light(),
      home: SplashScreen(
        next: ApiClient.instance.isSignedIn ? const MainShell() : const LoginScreen(),
      ),
    );
  }
}
