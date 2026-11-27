import 'package:flutter/material.dart';

import '../api.dart';
import '../roles.dart';
import 'delivery_home_screen.dart';
import 'home_screen.dart';
import 'manager_home_screen.dart';
import 'notifications_screen.dart';
import 'operator_home_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  Widget _homeFor(String role) {
    switch (role) {
      case AppRole.delivery:
        return const DeliveryHomeScreen();
      case AppRole.operator:
        return const OperatorHomeScreen();
      case AppRole.manager:
      case AppRole.admin:
        return const ManagerHomeScreen();
      default:
        return const HomeScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = ApiClient.instance.user?.role ?? AppRole.customer;
    final pages = <Widget>[
      _homeFor(role),
      const OrdersScreen(),
      const NotificationsScreen(),
      const ProfileScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (index) => setState(() => _index = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_rounded), label: 'Orders'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_rounded), label: 'Updates'),
          BottomNavigationBarItem(icon: Icon(Icons.person_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
