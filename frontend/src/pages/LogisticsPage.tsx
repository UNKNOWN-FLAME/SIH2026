import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../context/LanguageContext'

interface InventoryItemType {
  id: string
  name: string
  category: 'fuel' | 'food' | 'medical' | 'spares' | 'ppe' | 'water'
  quantity: number
  unit: string
  minThreshold: number
  burnRate: string
  daysLeft: number
  location: string
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL'
  lastAudit: string
}

const INITIAL_INVENTORY: Record<'maitri' | 'bharati', InventoryItemType[]> = {
  maitri: [
    { id: 'MT-FUEL-01', name: 'Polar Arctic High-Grade Diesel (Jet A-1 Spec)', category: 'fuel', quantity: 138400, unit: 'Litres', minThreshold: 35000, burnRate: '38 L/hr', daysLeft: 151, location: 'Fuel Farm Tank A-D', status: 'NOMINAL', lastAudit: '28-Aug-2026' },
    { id: 'MT-FUEL-02', name: 'Aviation Turbine Fuel (ATF) for Chetak/ALH Helis', category: 'fuel', quantity: 18200, unit: 'Litres', minThreshold: 6000, burnRate: 'On-demand', daysLeft: 210, location: 'Helipad Fuel Depot', status: 'NOMINAL', lastAudit: '28-Aug-2026' },
    { id: 'MT-FUEL-03', name: 'Low-Pour Synthetic Engine Lubricant (15W-40 Cold)', category: 'fuel', quantity: 840, unit: 'Litres', minThreshold: 250, burnRate: '2.5 L/day', daysLeft: 336, location: 'Powerhouse Store', status: 'NOMINAL', lastAudit: '20-Aug-2026' },
    { id: 'MT-FOOD-01', name: 'Freeze-Dried Retort Meal Packs (Indian Rations)', category: 'food', quantity: 4200, unit: 'Packs', minThreshold: 1200, burnRate: '30 pk/day', daysLeft: 140, location: 'Dry Provision Store', status: 'NOMINAL', lastAudit: '25-Aug-2026' },
    { id: 'MT-FOOD-02', name: 'Cryo-Preserved Vegetables & Dairy Powder', category: 'food', quantity: 680, unit: 'kg', minThreshold: 300, burnRate: '4.8 kg/day', daysLeft: 141, location: 'Cold Storage Room 1', status: 'NOMINAL', lastAudit: '25-Aug-2026' },
    { id: 'MT-MED-01', name: 'Medical Oxygen Cylinders (200 Bar High Pressure)', category: 'medical', quantity: 18, unit: 'Cylinders', minThreshold: 12, burnRate: 'Reserve', daysLeft: 360, location: 'Medical Bay 01', status: 'NOMINAL', lastAudit: '15-Aug-2026' },
    { id: 'MT-MED-02', name: 'Emergency Trauma & Frostbite Triage Kits', category: 'medical', quantity: 12, unit: 'Kits', minThreshold: 10, burnRate: 'Reserve', daysLeft: 365, location: 'Doctor Dispensary', status: 'NOMINAL', lastAudit: '15-Aug-2026' },
    { id: 'MT-SPARE-01', name: 'Kirloskar 100kVA Injector Nozzles & Filter Sets', category: 'spares', quantity: 8, unit: 'Sets', minThreshold: 6, burnRate: '1 set/mo', daysLeft: 240, location: 'Mechanical Workshop', status: 'NOMINAL', lastAudit: '22-Aug-2026' },
    { id: 'MT-SPARE-02', name: 'Trace Heating Replacement Cable (50m Drum)', category: 'spares', quantity: 3, unit: 'Drums', minThreshold: 4, burnRate: 'Critical Repair', daysLeft: 45, location: 'Electrical Annex', status: 'WARNING', lastAudit: '22-Aug-2026' },
    { id: 'MT-PPE-01', name: 'Extreme Cold Weather (ECW) Parkas & Snow Boots', category: 'ppe', quantity: 32, unit: 'Suits', minThreshold: 25, burnRate: 'Assigned', daysLeft: 365, location: 'Gear Locker', status: 'NOMINAL', lastAudit: '29-Aug-2026' },
    { id: 'MT-WAT-01', name: 'Priyadarshini Lake Water Filtration Cartridges', category: 'water', quantity: 14, unit: 'Cartridges', minThreshold: 8, burnRate: '2/mo', daysLeft: 210, location: 'Water Plant', status: 'NOMINAL', lastAudit: '20-Aug-2026' },
  ],
  bharati: [
    { id: 'BH-FUEL-01', name: 'Polar Arctic High-Grade Diesel (Jet A-1 Spec)', category: 'fuel', quantity: 210500, unit: 'Litres', minThreshold: 45000, burnRate: '46 L/hr', daysLeft: 190, location: 'Main Underground Bund', status: 'NOMINAL', lastAudit: '29-Aug-2026' },
    { id: 'BH-FUEL-02', name: 'Aviation Turbine Fuel (ATF) Bulk', category: 'fuel', quantity: 28400, unit: 'Litres', minThreshold: 8000, burnRate: 'On-demand', daysLeft: 280, location: 'Helipad Fuel Tanks', status: 'NOMINAL', lastAudit: '29-Aug-2026' },
    { id: 'BH-FOOD-01', name: 'Containerized Retort Rations & Basmati Rice', category: 'food', quantity: 5800, unit: 'kg', minThreshold: 1500, burnRate: '35 kg/day', daysLeft: 165, location: 'Containerized Galley', status: 'NOMINAL', lastAudit: '26-Aug-2026' },
    { id: 'BH-MED-01', name: 'Advanced Telemedicine & Defibrillator Modules', category: 'medical', quantity: 6, unit: 'Units', minThreshold: 4, burnRate: 'Active', daysLeft: 365, location: 'Hospital Ward', status: 'NOMINAL', lastAudit: '18-Aug-2026' },
    { id: 'BH-SPARE-01', name: 'BMS Actuators & Optical Fiber Splice Sleeves', category: 'spares', quantity: 18, unit: 'Boxes', minThreshold: 10, burnRate: 'Maintenance', daysLeft: 300, location: 'IT Server Bay', status: 'NOMINAL', lastAudit: '24-Aug-2026' },
    { id: 'BH-WAT-01', name: 'Sea-Water RO Desalination Membranes (4-stage)', category: 'water', quantity: 8, unit: 'Membranes', minThreshold: 10, burnRate: '1/45 days', daysLeft: 60, location: 'RO Desalination Plant', status: 'WARNING', lastAudit: '24-Aug-2026' },
    { id: 'BH-PPE-01', name: 'Polar Blizzard Harnesses & Crevasse Ropes', category: 'ppe', quantity: 45, unit: 'Sets', minThreshold: 30, burnRate: 'Active', daysLeft: 365, location: 'Safety Corridor', status: 'NOMINAL', lastAudit: '28-Aug-2026' },
  ],
}

export default function LogisticsPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const [activeStation, setActiveStation] = useState<'maitri' | 'bharati'>('maitri')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [inventory, setInventory] = useState(INITIAL_INVENTORY)
  const [showRequisitionModal, setShowRequisitionModal] = useState(false)
  const [reqItemName, setReqItemName] = useState('')
  const [reqQuantity, setReqQuantity] = useState('')
  const [reqPriority, setReqPriority] = useState('URGENT')
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null)

  const items = inventory[activeStation]
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const lowStockCount = items.filter((i) => i.quantity <= i.minThreshold || i.status === 'WARNING' || i.status === 'CRITICAL').length
  const totalItemsCount = items.length

  function handleAddRequisition(e: React.FormEvent) {
    e.preventDefault()
    if (!reqItemName.trim()) return

    setNotificationMsg(`[${new Date().toLocaleTimeString('en-GB')}] 📋 Requisition Indent Ref #MoES/NCPOR/IND-${Math.floor(1000 + Math.random() * 9000)} logged successfully and dispatched to Goa Logistics Directorate.`)
    setShowRequisitionModal(false)
    setReqItemName('')
    setReqQuantity('')
    setTimeout(() => setNotificationMsg(null), 6000)
  }

  function handleQuickStockAudit(itemId: string) {
    setInventory((prev) => ({
      ...prev,
      [activeStation]: prev[activeStation].map((item) =>
        item.id === itemId
          ? { ...item, lastAudit: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
          : item
      ),
    }))
    setNotificationMsg(`[${new Date().toLocaleTimeString('en-GB')}] ✅ Physical stock verification logged for SKU: ${itemId}`)
    setTimeout(() => setNotificationMsg(null), 4000)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setActiveStation((s) => (s === 'maitri' ? 'bharati' : 'maitri'))} />

        <main id="main-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
          <div style={{ flex: 1, padding: '10px 14px' }}>
            {/* Official Breadcrumbs Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#64748b',
                marginBottom: 10,
                padding: '6px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#0b3b60' }}>home</span>
                <button
                  onClick={() => navigate('/')}
                  style={{ background: 'none', border: 'none', color: '#0b3b60', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 11 }}
                >
                  {t('crumb.home')}
                </button>
                <span>&gt;</span>
                <span style={{ color: '#0b3b60', fontWeight: 600 }}>{t('crumb.polar_division')}</span>
                <span>&gt;</span>
                <span style={{ color: '#ea580c', fontWeight: 800 }}>
                  {lang === 'hi' ? 'ध्रुवीय रसद, ईंधन एवं आपूर्ति श्रृंखला' : 'Polar Logistics, Fuel & Life-Support Supply Chain'}
                </span>
              </div>

              {/* Station Switcher */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setActiveStation('maitri')}
                  style={{
                    background: activeStation === 'maitri' ? '#0b3b60' : '#ffffff',
                    color: activeStation === 'maitri' ? '#ffffff' : '#0b3b60',
                    border: '1px solid #0b3b60',
                    padding: '3px 10px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  मैत्री (Maitri Stock)
                </button>
                <button
                  onClick={() => setActiveStation('bharati')}
                  style={{
                    background: activeStation === 'bharati' ? '#0b3b60' : '#ffffff',
                    color: activeStation === 'bharati' ? '#ffffff' : '#0b3b60',
                    border: '1px solid #0b3b60',
                    padding: '3px 10px',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  भारती (Bharati Stock)
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {notificationMsg && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  color: '#166534',
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                <span>{notificationMsg}</span>
              </div>
            )}

            {/* Top KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 12 }}>
              {/* Card 1: Tracked Inventory Items */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0b3b60', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'निगरानीधीन वस्तुएं' : 'ACTIVE MONITORED SKUs'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0b3b60' }}>inventory_2</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#0b3b60' }}>{totalItemsCount}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Critical Life-Support SKUs</span>
                </div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                  100% Items RFID & Barcode Tagged
                </div>
              </div>

              {/* Card 2: Low-Stock Warnings */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #ea580c', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'पुनःआपूर्ति आवश्यक' : 'RESTOCK ATTENTION'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ea580c' }}>warning</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: lowStockCount > 0 ? '#ea580c' : '#16a34a' }}>
                    {lowStockCount}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>SKUs Below Threshold</span>
                </div>
                <div style={{ fontSize: 10, color: '#ea580c', fontWeight: 600, marginTop: 4 }}>
                  Requisitions Generated for 45th ISEA Voyage
                </div>
              </div>

              {/* Card 3: Days of Autonomy */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #16a34a', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'स्टेशन स्वायत्तता' : 'STATION SURVIVAL AUTONOMY'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>timer</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>
                    {activeStation === 'maitri' ? '151' : '190'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Days Nominal Margin</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 4 }}>
                  Winter Isolation Rating: <strong style={{ color: '#16a34a' }}>EXCELLENT</strong>
                </div>
              </div>

              {/* Card 4: Resupply Ship Tracker */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0284c7', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'अभियान पोत' : 'EXPEDITION VESSEL ETA'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0284c7' }}>directions_boat</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>MV Vasiliy Golovnin</span>
                </div>
                <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 700, marginTop: 4 }}>
                  68 Days to Ice Edge (Mormugao ➔ Cape Town)
                </div>
              </div>
            </div>

            {/* Inventory Management & Filtering Bar */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '12px 16px', marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                {/* Search Box */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 260 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#64748b' }}>search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SKU ID, item description, location..."
                    style={{
                      flex: 1,
                      border: '1px solid #cbd5e1',
                      padding: '5px 10px',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowRequisitionModal(true)}
                    style={{
                      background: '#0b3b60',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 2,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_shopping_cart</span>
                    <span>{lang === 'hi' ? 'मांग पत्र तैयार करें' : 'Raise Indent / Requisition'}</span>
                  </button>

                  <button
                    onClick={() => alert('Official Indent Manifest exported to PDF: REF-NCPOR-LOG-2026-AUG.pdf')}
                    style={{
                      background: '#ffffff',
                      color: '#0b3b60',
                      border: '1px solid #0b3b60',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 2,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>picture_as_pdf</span>
                    <span>{lang === 'hi' ? 'आधिकारिक पीडीएफ' : 'Export Official PDF'}</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Categories' },
                  { id: 'fuel', label: '⛽ Arctic Fuel & ATF' },
                  { id: 'food', label: '🍲 Rations & Provisions' },
                  { id: 'medical', label: '🏥 Medical & Trauma' },
                  { id: 'spares', label: '⚙️ Power & BMS Spares' },
                  { id: 'ppe', label: '🧥 ECW Gear & Harness' },
                  { id: 'water', label: '💧 Potable Water Plant' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      background: selectedCategory === cat.id ? '#0b3b60' : '#f1f5f9',
                      color: selectedCategory === cat.id ? '#ffffff' : '#334155',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 10.5,
                      fontWeight: selectedCategory === cat.id ? 800 : 600,
                      cursor: 'pointer',
                      borderRadius: 3,
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Table */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#0b3b60', color: '#ffffff', borderBottom: '2px solid #ff9933' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>SKU ID</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Item Description</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Category</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Current Stock</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Min Threshold</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Burn / Consumption</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Autonomy Margin</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Storage Location</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Status</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const isLow = item.quantity <= item.minThreshold || item.status === 'WARNING'
                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                          {item.id}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '8px 12px', textTransform: 'uppercase', fontSize: 10, color: '#64748b', fontWeight: 800 }}>
                          {item.category}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 800, color: isLow ? '#ea580c' : '#0f172a' }}>
                          {item.quantity.toLocaleString()} {item.unit}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                          {item.minThreshold.toLocaleString()} {item.unit}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>
                          {item.burnRate}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 800, color: item.daysLeft < 60 ? '#ea580c' : '#16a34a' }}>
                          {item.daysLeft} Days
                        </td>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                          {item.location}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 2,
                              background: isLow ? '#fee2e2' : '#dcfce7',
                              color: isLow ? '#991b1b' : '#166534',
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button
                            onClick={() => handleQuickStockAudit(item.id)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#0b3b60',
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: 'pointer',
                              borderRadius: 2,
                            }}
                            title={`Last verified on: ${item.lastAudit}`}
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Requisition Indent Modal */}
          {showRequisitionModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16,
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  width: '100%',
                  maxWidth: 480,
                  border: '1px solid #cbd5e1',
                  borderTop: '4px solid #0b3b60',
                  padding: 20,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0b3b60', margin: 0 }}>
                      OFFICIAL MOES POLAR INDENT / REQUISITION
                    </h3>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      Station: {activeStation.toUpperCase()} • 45th Indian Scientific Expedition
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRequisitionModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddRequisition} style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                  <div>
                    <label style={{ fontWeight: 800, color: '#0b3b60', display: 'block', marginBottom: 4 }}>
                      Item Description / Part Number:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Trace Heating Replacement Cable 50m"
                      value={reqItemName}
                      onChange={(e) => setReqItemName(e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 11, outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontWeight: 800, color: '#0b3b60', display: 'block', marginBottom: 4 }}>
                        Requisition Quantity:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 5 Drums"
                        value={reqQuantity}
                        onChange={(e) => setReqQuantity(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 11, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 800, color: '#0b3b60', display: 'block', marginBottom: 4 }}>
                        Priority Level:
                      </label>
                      <select
                        value={reqPriority}
                        onChange={(e) => setReqPriority(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 11, outline: 'none' }}
                      >
                        <option value="CRITICAL">🔴 CRITICAL (Emergency Air-drop)</option>
                        <option value="URGENT">🟠 URGENT (Shipment Resupply)</option>
                        <option value="ROUTINE">🟢 ROUTINE (Annual Cycle)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowRequisitionModal(false)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ background: '#0b3b60', color: '#ffffff', border: 'none', padding: '6px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                    >
                      Submit Official Indent
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <Footer />
        </main>
      </div>
    </div>
  )
}
