import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You can sign back in any time.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Stay'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ApiClient.instance.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ApiClient.instance.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: const LinearGradient(
                colors: [AppColors.navy, Color(0xFF273556)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Colors.white.withValues(alpha: 0.16),
                  child: Text(
                    '${user?.firstName[0] ?? 'L'}${user?.lastName[0] ?? ''}',
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.fullName ?? 'Listro customer',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(color: Color(0xFFB9C5DA), fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.teal.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          user?.role ?? 'CUSTOMER',
                          style: const TextStyle(color: Color(0xFF9AF0E8), fontSize: 10, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const Text('Account', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          const Card(
            child: Column(
              children: [
                ListTile(
                  leading: Icon(Icons.badge_outlined, color: AppColors.primary),
                  title: Text('Customer ID'),
                  subtitle: Text('Managed securely by Listro'),
                ),
                Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.shield_outlined, color: AppColors.teal),
                  title: Text('Privacy & security'),
                  subtitle: Text('Your data is protected'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const Text('About', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          const Card(
            child: ListTile(
              leading: Icon(Icons.auto_awesome_rounded, color: AppColors.secondary),
              title: Text('Listro for customers'),
              subtitle: Text('Premium shoe care, tracked end to end.'),
            ),
          ),
          const SizedBox(height: 28),
          OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout_rounded, color: AppColors.rose),
            label: const Text('Sign out', style: TextStyle(color: AppColors.rose)),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              side: const BorderSide(color: AppColors.rose),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            ),
          ),
        ],
      ),
    );
  }
}
