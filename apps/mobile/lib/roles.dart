class AppRole {
  static const customer = 'CUSTOMER';
  static const delivery = 'DELIVERY';
  static const operator = 'OPERATOR';
  static const manager = 'MANAGER';
  static const admin = 'ADMIN';

  static bool isManager(String role) => role == manager || role == admin;

  static bool canCancel(String role) => isManager(role) || role == customer;

  static bool canUseWeb(String role) => isManager(role) || role == operator;

  static List<String> liveStatuses(String role) {
    const active = [
      'PLACED',
      'CONFIRMED',
      'DELIVERY_ASSIGNED',
      'PICKUP_IN_PROGRESS',
      'RECEIVED_AT_CENTER',
      'WASHING_IN_PROGRESS',
      'WASHING_COMPLETED',
      'READY_FOR_DELIVERY',
      'OUT_FOR_DELIVERY',
    ];
    switch (role) {
      case operator:
        return const ['RECEIVED_AT_CENTER', 'WASHING_IN_PROGRESS', 'WASHING_COMPLETED'];
      case delivery:
        return const [
          'DELIVERY_ASSIGNED',
          'PICKUP_IN_PROGRESS',
          'READY_FOR_DELIVERY',
          'OUT_FOR_DELIVERY',
        ];
      default:
        return active;
    }
  }

  static String liveTitle(String role) {
    switch (role) {
      case operator:
        return 'Live cleaning queue';
      case delivery:
        return 'Live delivery queue';
      case manager:
      case admin:
        return 'Live branch orders';
      default:
        return 'Live order';
    }
  }

  static String liveSubtitle(String role) {
    switch (role) {
      case operator:
        return 'Shoes currently moving through your bench';
      case delivery:
        return 'Pickups and returns that need your attention';
      case manager:
      case admin:
        return 'Active work across the branch';
      default:
        return 'Your order status updates as it moves';
    }
  }

  static String label(String role) {
    switch (role) {
      case delivery:
        return 'Delivery partner';
      case operator:
        return 'Cleaning operator';
      case manager:
        return 'Branch manager';
      case admin:
        return 'Administrator';
      default:
        return 'Customer';
    }
  }
}

double workflowProgress(String status) {
  const steps = [
    'PLACED',
    'CONFIRMED',
    'DELIVERY_ASSIGNED',
    'PICKUP_IN_PROGRESS',
    'RECEIVED_AT_CENTER',
    'WASHING_IN_PROGRESS',
    'WASHING_COMPLETED',
    'READY_FOR_DELIVERY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ];
  if (status == 'CANCELLED' || status == 'REJECTED') return 0;
  final index = steps.indexOf(status);
  if (index < 0) return 0;
  return (index + 1) / steps.length;
}
