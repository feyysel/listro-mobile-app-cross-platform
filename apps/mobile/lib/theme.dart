import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _themeModeKey = 'listro_theme_mode';

class AppThemeController {
  static final ValueNotifier<ThemeMode> mode = ValueNotifier(ThemeMode.system);

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    mode.value = _fromKey(prefs.getString(_themeModeKey));
    mode.addListener(() {
      prefs.setString(_themeModeKey, _toKey(mode.value));
    });
  }

  static Future<void> setMode(ThemeMode value) async {
    mode.value = value;
  }

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static ThemeMode _fromKey(String? value) {
    switch (value) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  static String _toKey(ThemeMode value) {
    switch (value) {
      case ThemeMode.light:
        return 'light';
      case ThemeMode.dark:
        return 'dark';
      case ThemeMode.system:
        return 'system';
    }
  }
}

class AppColors {
  static const Color ink = Color(0xFF101828);
  static const Color muted = Color(0xFF667085);
  static const Color canvas = Color(0xFFF6F7FB);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color primary = Color(0xFF5B5BD6);
  static const Color secondary = Color(0xFF8B5CF6);
  static const Color teal = Color(0xFF0EA5A4);
  static const Color amber = Color(0xFFF59E0B);
  static const Color rose = Color(0xFFE5484D);
  static const Color green = Color(0xFF12A594);
  static const Color navy = Color(0xFF0B1220);
}

class AppTheme {
  static ThemeData light() => _build(
        scheme: const ColorScheme.light(
          primary: AppColors.primary,
          onPrimary: Colors.white,
          secondary: AppColors.teal,
          onSecondary: Colors.white,
          surface: AppColors.surface,
          error: AppColors.rose,
          onSurface: AppColors.ink,
        ),
        canvas: AppColors.canvas,
        border: const Color(0xFFE7EAF0),
        input: Colors.white,
      );

  static ThemeData dark() => _build(
        scheme: const ColorScheme.dark(
          primary: Color(0xFF9C9CFF),
          onPrimary: Color(0xFF15143B),
          secondary: Color(0xFF5EEAD4),
          onSecondary: Color(0xFF062521),
          surface: Color(0xFF151C2D),
          error: Color(0xFFFF8A90),
          onError: Color(0xFF3B0A12),
          onSurface: Color(0xFFE9EDF7),
        ),
        canvas: const Color(0xFF0B1020),
        border: const Color(0xFF26314A),
        input: const Color(0xFF111A2C),
      );

  static ThemeData _build({
    required ColorScheme scheme,
    required Color canvas,
    required Color border,
    required Color input,
  }) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: canvas,
      appBarTheme: AppBarTheme(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: scheme.onSurface),
        titleTextStyle: TextStyle(
          color: scheme.onSurface,
          fontSize: 24,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.6,
        ),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(20)),
          side: BorderSide(color: border),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: input,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 1.5),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: scheme.surface,
        selectedItemColor: scheme.primary,
        unselectedItemColor: scheme.onSurface.withValues(alpha: 0.56),
        type: BottomNavigationBarType.fixed,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        elevation: 12,
      ),
    );
  }
}
