import Image from 'next/image';

export function AuthHero() {
  return (
    <div className="relative h-full">
      <Image
        src="/images/auth-hero.jpg"
        alt="Abstract geometric pattern"
        className="object-cover"
        fill
        priority
        sizes="50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30" />
      <div className="absolute inset-x-0 bottom-0 p-12">
        <blockquote className="space-y-2">
          <p className="text-lg leading-relaxed text-white">
            "This library has saved me countless hours of work and helped me deliver stunning designs to my clients faster than ever before. Highly recommended!"
          </p>
          <footer className="text-sm text-white/70">Sofia Davis</footer>
        </blockquote>
      </div>
    </div>
  );
}
