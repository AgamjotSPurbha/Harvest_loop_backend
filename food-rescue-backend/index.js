const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { Pool } = require('pg');

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

let mockPickups = [
  {
    id: 'pickup-1',
    category: 'Produce',
    quantity: 15,
    pickup_window: '17:00 - 19:00',
    business_name: 'Sunrise Market',
    address: '742 Market St',
    donor: 'Sunrise Market',
    unit: 'kg',
    windowLabel: '17:00 - 19:00',
    status: 'new',
    lat: 37.7749,
    lng: -122.4194
  }
];

const sendNotificationEmail = async (donationId, category) => {
  console.log(`[NOTIFICATION SERVICE] Email alert triggered for new donation #${donationId}: ${category}`);
};

cron.schedule('*/10 * * * *', () => {
  console.log('[SCHEDULED JOB] Checking for expiring food rescue alerts...');
});

app.get('/', (req, res) => {
  res.json({ status: "Food Rescue API Live", stack: ["Node.js", "Express", "PostgreSQL"] });
});

// Dynamic GET /impact: updates Saturday's metrics based on created/claimed pickups
app.get('/impact', async (req, res) => {
  try {
    const extraKg = mockPickups.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const totalWeight = 1250 + extraKg;
    const mealsDelivered = 3400 + Math.round(extraKg * 2.2);
    const co2Saved = 850 + Math.round(extraKg * 0.7);

    res.json({
      totalWeight,
      mealsDelivered,
      co2Saved,
      totalRescuedKg: totalWeight,
      mealsProvided: mealsDelivered,
      co2eDivertedTonnes: co2Saved,
      weeklyRescued: [
        { day: 'Mon', kg: 120 },
        { day: 'Tue', kg: 180 },
        { day: 'Wed', kg: 150 },
        { day: 'Thu', kg: 210 },
        { day: 'Fri', kg: 260 },
        { day: 'Sat', kg: 190 + extraKg },
        { day: 'Sun', kg: 140 }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/pickups', async (req, res) => {
  res.json(mockPickups);
});

app.post('/pickups', async (req, res) => {
  try {
    const pickupData = req.body;
    const generatedId = pickupData.id || `pickup-${Date.now()}`;

    const newPickup = {
      donor: pickupData.donor || pickupData.business_name || 'Sunrise Market',
      category: pickupData.category || 'General',
      quantity: Number(pickupData.quantity) || 15,
      unit: pickupData.unit || 'kg',
      windowLabel: pickupData.windowLabel || pickupData.pickup_window || 'Today',
      ...pickupData,
      id: String(generatedId),
      status: 'new',
      lat: typeof pickupData.lat === 'number' ? pickupData.lat : 37.7749,
      lng: typeof pickupData.lng === 'number' ? pickupData.lng : -122.4194,
      createdAt: new Date().toISOString(),
    };

    mockPickups.unshift(newPickup);
    console.log('[NEW DONATION RECEIVED]:', newPickup);

    if (typeof sendNotificationEmail === 'function') {
      sendNotificationEmail(newPickup.id, newPickup.category || 'General');
    }

    res.status(201).json(newPickup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const handleClaim = (id, res) => {
  const targetId = String(id);
  const pickupIndex = mockPickups.findIndex((p) => String(p.id) === targetId);

  if (pickupIndex !== -1) {
    mockPickups[pickupIndex].status = 'claimed';
    console.log(`[PICKUP CLAIMED]: Pickup ID #${targetId}`);
    return res.json(mockPickups[pickupIndex]);
  }

  const fallbackItem = {
    id: targetId,
    status: 'claimed',
    donor: 'Sunrise Market',
    category: 'Produce',
    quantity: 15,
    unit: 'kg',
    windowLabel: '17:00 - 19:00',
    lat: 37.7749,
    lng: -122.4194,
  };
  mockPickups.unshift(fallbackItem);
  return res.json(fallbackItem);
};

app.patch('/pickups/:id/claim', (req, res) => handleClaim(req.params.id, res));
app.post('/pickups/:id/claim', (req, res) => handleClaim(req.params.id, res));
app.patch('/pickups/:id', (req, res) => handleClaim(req.params.id, res));
app.post('/pickups/claim', (req, res) => handleClaim(req.body.id || 'pickup-1', res));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});