import { ensureDemoFlightAndSeedPassengers } from '../src/lib/demo/seeder';

async function main() {
  console.log('Seeding Hamsafar Airport demo flight and 30 passengers...');
  const result = await ensureDemoFlightAndSeedPassengers(undefined, 30);
  console.log(
    `Done! Seeded ${result.seededCount} passengers on flight ID ${result.flightId}.`
  );
}

main().catch((err) => {
  console.error('Demo seed error:', err);
  process.exit(1);
});
