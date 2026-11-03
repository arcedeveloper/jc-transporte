import { Faq, Hero, HowItWorks, Reasons, Testimonials } from '@/components/landing';
import { FeaturedTrips } from '@/components/promos';
import { SuggestionsSection } from '@/components/suggestions';

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="mt-12">
        <FeaturedTrips />
      </div>
      <HowItWorks />
      <Reasons />
      <SuggestionsSection />
      <Testimonials />
      <Faq />
    </>
  );
}
