import { SiteFooter, SiteHeader, WhatsAppFloat } from '@/components/site-chrome';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  );
}
