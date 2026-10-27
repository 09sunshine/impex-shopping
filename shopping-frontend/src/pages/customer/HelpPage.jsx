import React from 'react';
import { useTranslation } from '../../context/LanguageContext';
import { HelpCircle, MapPin, Phone, Mail, Clock, ShieldCheck, Truck, Package } from 'lucide-react';

export default function HelpPage() {
  const { t } = useTranslation();
  const faqs = [
    {
      q: 'How does IMPEX International Shopping work?',
      a: 'You browse and order items from international merchants (Amazon, eBay, AliExpress, SHEIN, etc.) directly on IMPEX. You pay with your IMPEX wallet balance. We procure the item, receive it at our Florida facility, transport it via air freight to Haiti, clear customs, and prepare it for pickup or home delivery.',
    },
    {
      q: 'Can I change the US receiving depot address?',
      a: 'No. To ensure 100% customs clearance and tracking integrity into Haiti, all orders must be delivered to the official IMPEX bonded facility in Florida. Once the package lands in Haiti, you can request home delivery to any commune.',
    },
    {
      q: 'How do I top up my wallet?',
      a: 'You can top up your wallet with MonCash (+509 3700-4673), NatCash (+509 4100-4673), Unibank/Sogebank transfer, or cash at any IMPEX branch in Port-au-Prince.',
    },
    {
      q: 'How long does delivery to Haiti take?',
      a: 'Once the merchant delivers the package to our Florida depot, priority air cargo typically arrives in Port-au-Prince within 3 to 5 business days.',
    },
  ];

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('help.title')}</h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {t('help.subtitle')}
        </p>
      </div>

      {/* Warehouse Locations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
        <div className="impex-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <MapPin size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Haiti Central Hub (Pickup & Dispatch)</h3>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div>IMPEX Logistics Complex, Boulevard Toussaint Louverture</div>
            <div>Port-au-Prince, Haiti</div>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              <span>Monday – Saturday: 8:00 AM – 5:00 PM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Phone size={14} />
              <span>+509 2816-4673 / +509 3700-4673</span>
            </div>
          </div>
        </div>

        <div className="impex-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <MapPin size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>US Bonded Receiving Facility</h3>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div>IMPEX Logistics Center, 8400 NW 25th St</div>
            <div>Doral, FL 33198, USA</div>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Clock size={14} />
              <span>Receiving: Mon – Fri 9:00 AM – 6:00 PM EST</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <Mail size={14} />
              <span>cargo@impexht.com</span>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Accordion List */}
      <div className="impex-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Frequently Asked Questions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-muted)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
              }}
            >
              <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                {faq.q}
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
