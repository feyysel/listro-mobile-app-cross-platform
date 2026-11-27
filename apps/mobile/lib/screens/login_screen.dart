import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import 'main_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController(text: 'customer@listro.test');
  final _password = TextEditingController(text: 'Customer@123');
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _phone = TextEditingController();
  bool _registering = false;
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_registering) {
        await ApiClient.instance.register(
          firstName: _firstName.text.trim(),
          lastName: _lastName.text.trim(),
          email: _email.text.trim(),
          phone: _phone.text.trim(),
          password: _password.text,
        );
      } else {
        await ApiClient.instance.login(_email.text.trim(), _password.text);
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainShell()),
      );
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(28, 36, 28, 44),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.navy, Color(0xFF1B2543)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(36),
                    bottomRight: Radius.circular(36),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            gradient: const LinearGradient(
                              colors: [AppColors.primary, AppColors.secondary],
                            ),
                          ),
                          child: const Icon(Icons.auto_awesome, color: Colors.white),
                        ),
                        const SizedBox(width: 12),
                        const Text(
                          'Listro',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.8,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 30),
                    Text(
                      _registering ? 'Join Listro' : 'Your shoes,\nbeautifully cared for.',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        height: 1.08,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.2,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      _registering
                          ? 'Create an account to request pickup and track every clean.'
                          : 'Book a clean in moments. Follow every step to your doorstep.',
                      style: const TextStyle(color: Color(0xFFAEBBD1), fontSize: 14, height: 1.5),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_registering) ...[
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _firstName,
                                decoration: const InputDecoration(labelText: 'First name'),
                                validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: _lastName,
                                decoration: const InputDecoration(labelText: 'Last name'),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(labelText: 'Phone number'),
                          validator: (value) => value == null || value.trim().length < 9 ? 'Enter a valid phone' : null,
                        ),
                        const SizedBox(height: 14),
                      ],
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email address'),
                        validator: (value) => value == null || !value.contains('@') ? 'Enter a valid email' : null,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          suffixIcon: IconButton(
                            icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        validator: (value) => value == null || value.length < 8 ? 'At least 8 characters' : null,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: const TextStyle(color: AppColors.rose, fontSize: 12)),
                      ],
                      const SizedBox(height: 22),
                      ElevatedButton(
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : Text(_registering ? 'Create account' : 'Sign in'),
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => setState(() {
                          _registering = !_registering;
                          _error = null;
                        }),
                        child: Text(_registering
                            ? 'Already have an account? Sign in'
                            : 'New to Listro? Create an account'),
                      ),
                      if (!_registering)
                        Container(
                          margin: const EdgeInsets.only(top: 18),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE7EAF0)),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Demo customer', style: TextStyle(fontWeight: FontWeight.w700)),
                              SizedBox(height: 4),
                              Text(
                                'customer@listro.test · Customer@123',
                                style: TextStyle(color: AppColors.muted, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
