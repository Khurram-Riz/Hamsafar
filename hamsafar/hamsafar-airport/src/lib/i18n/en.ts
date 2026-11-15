export const en = {
  brand: {
    name: 'Hamsafar Airport',
    tagline: 'One flight, one ride, a fairer fare.',
    airportLabel: 'Jinnah International Airport (KHI)',
  },
  nav: {
    bookRide: 'Book Ride',
    myTrips: 'My Trips',
    demoConsole: 'Demo Console',
    profile: 'Profile',
    signIn: 'Sign In',
    signOut: 'Sign Out',
  },
  demo: {
    banner: 'DEMO MODE — Placeholder fares & simulated OTP/payments active.',
    placeholderTag: 'Placeholder figure (unverified)',
  },
  poolTypes: {
    open: {
      label: 'Open Pool',
      description: 'Any verified passenger on your flight heading along your corridor.',
    },
    women_only: {
      label: 'Women-Only Pool',
      description: 'Strictly matched only with verified female travelers.',
    },
    family_only: {
      label: 'Family-Only Pool',
      description: 'Matched exclusively with groups of 2+ traveling together.',
    },
  },
  luggage: {
    light: 'Light (1 cabin bag)',
    medium: 'Medium (1 suitcase + cabin)',
    heavy: 'Heavy (2+ large bags)',
  },
  safety: {
    reportButton: 'Report a safety or pricing issue',
    shareTripButton: 'Share live trip with family',
  },
} as const;

export type Dictionary = typeof en;
