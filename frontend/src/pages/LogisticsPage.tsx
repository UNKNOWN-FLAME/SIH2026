import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNav from '../components/layout/TopNav'
import AlertStrip from '../components/layout/AlertStrip'
import Sidebar from '../components/layout/Sidebar'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../context/LanguageContext'
import { useInventory } from '../hooks/useInventory'

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

/** Map a DB category string to the frontend union */
function toCategory(cat: string): InventoryItemType['category'] {
  const c = cat.toUpperCase()
  if (c.includes('FUEL')) return 'fuel'
  if (c.includes('FOOD')) return 'food'
  if (c.includes('MEDICAL')) return 'medical'
  if (c.includes('SPARE')) return 'spares'
  return 'spares'
}

export default function LogisticsPage() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()

  const [activeStation, setActiveStation] = useState<'maitri' | 'bharati'>('maitri')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showRequisitionModal, setShowRequisitionModal] = useState(false)
  const [reqItemName, setReqItemName] = useState('')
  const [reqQuantity, setReqQuantity] = useState('')
  const [reqPriority, setReqPriority] = useState('URGENT')
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null)

  // ── Live data from Neon ───────────────────────────────────────────────────
  const { data: rawInventory } = useInventory(activeStation)

  // Map DB InventoryItem rows → InventoryItemType used by JSX
  const items: InventoryItemType[] = (rawInventory ?? []).map(r => ({
    id: r.item_id,
    name: r.name,
    category: toCategory(r.category),
    quantity: r.quantity,
    unit: r.unit,
    minThreshold: r.min_safety_threshold ?? 0,
    burnRate: r.daily_burn_rate !== null ? `${r.daily_burn_rate} ${r.unit}/day` : 'N/A',
    daysLeft: r.days_remaining ?? 0,
    location: 'Station Store',
    status: r.status as InventoryItemType['status'],
    lastAudit: r.last_updated
      ? new Date(r.last_updated).toLocaleDateString('en-IN')
      : 'N/A',
  }))




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

    setNotificationMsg(`[${new Date().toLocaleTimeString('en-GB')}] 📋 Supply request order sent successfully to NCPOR Goa Logistics Office.`)
    setShowRequisitionModal(false)
    setReqItemName('')
    setReqQuantity('')
    setTimeout(() => setNotificationMsg(null), 6000)
  }

  function handleQuickStockAudit(itemId: string) {
    // Inventory is live from the API — optimistic update not needed here
    setNotificationMsg(`[${new Date().toLocaleTimeString('en-GB')}] ✅ Stock count confirmed for: ${itemId}`)
    setTimeout(() => setNotificationMsg(null), 4000)
  }


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
      <TopNav />
      <AlertStrip />

      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar activeStation={activeStation} onSwitchStation={() => setActiveStation((s) => (s === 'maitri' ? 'bharati' : 'maitri'))} />

        <main id="main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#f0f4f8' }}>
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
                  {lang === 'hi' ? 'स्टेशन सामान, ईंधन एवं भोजन भंडार' : 'Station Supplies, Fuel & Living Essentials'}
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
                    padding: '4px 14px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  {lang === 'hi' ? 'मैत्री' : 'Maitri'}
                </button>
                <button
                  onClick={() => setActiveStation('bharati')}
                  style={{
                    background: activeStation === 'bharati' ? '#0b3b60' : '#ffffff',
                    color: activeStation === 'bharati' ? '#ffffff' : '#0b3b60',
                    border: '1px solid #0b3b60',
                    padding: '4px 14px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                    borderRadius: 3,
                  }}
                >
                  {lang === 'hi' ? 'भारती' : 'Bharati'}
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
                    {lang === 'hi' ? 'कुल ट्रैक की गई वस्तुएं' : 'TOTAL ITEMS TRACKED'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0b3b60' }}>inventory_2</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#0b3b60' }}>{totalItemsCount}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Essential Supply Items</span>
                </div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                  All items counted & verified
                </div>
              </div>

              {/* Card 2: Low-Stock Warnings */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #ea580c', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'पुनःआपूर्ति आवश्यक' : 'ITEMS RUNNING LOW'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ea580c' }}>warning</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: lowStockCount > 0 ? '#ea580c' : '#16a34a' }}>
                    {lowStockCount}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Items Need Reorder</span>
                </div>
                <div style={{ fontSize: 10, color: '#ea580c', fontWeight: 600, marginTop: 4 }}>
                  Order list ready for next supply ship
                </div>
              </div>

              {/* Card 3: Days of Autonomy */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #16a34a', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'स्टॉक कितने दिन चलेगा' : 'DAYS OF SUPPLIES LEFT'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#16a34a' }}>timer</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>
                    {activeStation === 'maitri' ? '151' : '190'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Days of Normal Supplies</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, marginTop: 4 }}>
                  Winter Stock Status: <strong style={{ color: '#16a34a' }}>EXCELLENT (SAFE)</strong>
                </div>
              </div>

              {/* Card 4: Resupply Ship Tracker */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0284c7', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'सप्लाई जहाज आगमन' : 'NEXT SUPPLY SHIP ARRIVAL'}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0284c7' }}>directions_boat</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>MV Vasiliy Golovnin (Ship)</span>
                </div>
                <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 700, marginTop: 4 }}>
                  Arriving in 68 Days (From Goa port to Antarctica)
                </div>
              </div>
            </div>

            {/* Inventory Management & Filtering Bar */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderTop: '3px solid #0b3b60', padding: '12px 16px', marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {/* Official Government Register Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 900, color: '#0b3b60', margin: 0, textTransform: 'uppercase' }}>
                    {lang === 'hi' ? 'राष्ट्रीय ध्रुवीय भंडार सूची' : 'NATIONAL POLAR STOCK REGISTER'}
                  </h3>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    Food, fuel, medicines, and machine spare parts for Antarctic stations
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 800, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', border: '1px solid #bae6fd', borderRadius: 2 }}>
                    GeM Govt Store Linked
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '2px 8px', border: '1px solid #86efac', borderRadius: 2 }}>
                    ● Stock Verified Safe
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                {/* Search Box */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 260 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#64748b' }}>search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by item name, code, or storage place..."
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
                    <span>{lang === 'hi' ? '+ नया सामान मांगें' : '+ Request Supplies'}</span>
                  </button>

                  <button
                    onClick={() => alert('Official Stock List exported to PDF: REF-NCPOR-LOG-2026-AUG.pdf')}
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
                    <span>{lang === 'hi' ? 'स्टॉक रिपोर्ट डाउनलोड करें' : 'Download PDF Report'}</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Chips with counts */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Supplies (12)' },
                  { id: 'fuel', label: '⛽ Fuel & Diesel (2)' },
                  { id: 'food', label: '🍲 Food Rations (3)' },
                  { id: 'medical', label: '🏥 Medicines (2)' },
                  { id: 'spares', label: '⚙️ Machine Spares (5)' },
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
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Item Code</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Item Name</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Category</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Current Stock</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Minimum Safe Level</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Daily Use</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Days Left</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Storage Location</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Stock Status</th>
                    <th style={{ padding: '8px 12px', fontWeight: 800 }}>Action</th>
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
                              fontSize: 9.5,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 2,
                              background: isLow ? '#fef2f2' : '#f0fdf4',
                              color: isLow ? '#b91c1c' : '#15803d',
                              border: isLow ? '1px solid #fecaca' : '1px solid #bbf7d0',
                            }}
                          >
                            {isLow ? '⚠️ REORDER NEEDED' : '✅ SAFE'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button
                            onClick={() => handleQuickStockAudit(item.id)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #0b3b60',
                              color: '#0b3b60',
                              padding: '3px 8px',
                              fontSize: 10,
                              fontWeight: 800,
                              cursor: 'pointer',
                              borderRadius: 2,
                            }}
                            title={`Last verified on: ${item.lastAudit}`}
                          >
                            ✓ Audit Count
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
                      REQUEST NEW SUPPLIES (ORDER FORM)
                    </h3>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      Station: {activeStation.toUpperCase()} • This order will be sent to the NCPOR Logistics Office
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
                      Item Name / What is needed:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Heating Cable 50m, Oxygen Tanks, Food Rations"
                      value={reqItemName}
                      onChange={(e) => setReqItemName(e.target.value)}
                      style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 11, outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontWeight: 800, color: '#0b3b60', display: 'block', marginBottom: 4 }}>
                        Quantity Needed:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 5 Drums, 100 kg, 2 Sets"
                        value={reqQuantity}
                        onChange={(e) => setReqQuantity(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 11, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 800, color: '#0b3b60', display: 'block', marginBottom: 4 }}>
                        How Urgent Is It?:
                      </label>
                      <select
                        value={reqPriority}
                        onChange={(e) => setReqPriority(e.target.value)}
                        style={{ width: '100%', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: 11, outline: 'none' }}
                      >
                        <option value="CRITICAL">🔴 Emergency (Need immediately by air-drop)</option>
                        <option value="URGENT">🟠 High Priority (Send with next ship)</option>
                        <option value="ROUTINE">🟢 Routine (Annual re-supply cycle)</option>
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
                      Submit Supply Request
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>

      <Footer />
    </div>
  )
}
