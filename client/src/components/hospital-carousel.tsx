import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import imgCafeteria from "@assets/2025-04-17_at_5.54.36_PM_-_Copy_-_Copy_1772013382592.png";
import imgTwinRoom from "@assets/2025-04-17_at_5.57.31_PM_-_Copy_1772013382593.png";
import imgLobby from "@assets/2025-04-17_at_5.58.39_PM_1772013382593.png";
import imgSuite from "@assets/2025-04-17_at_6.01.09_PM_1772013382593.png";
import imgPhysio from "@assets/2025-04-17_at_6.08.40_PM_1772013382593.png";
import imgBuilding from "@assets/DJI_0705_1772013382593.jpg";
import imgOPD from "@assets/OPD_1772013382594.png";

const images = [
  { src: imgBuilding, label: "Hospital Building" },
  { src: imgOPD, label: "OPD" },
  { src: imgLobby, label: "3rd Floor Lobby" },
  { src: imgTwinRoom, label: "Twin Sharing Room" },
  { src: imgSuite, label: "Presidential Suite" },
  { src: imgCafeteria, label: "Cafeteria" },
  { src: imgPhysio, label: "Physiotherapy" },
];

export function HospitalCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalImages = images.length;
  const extendedImages = [...images, ...images, ...images];
  const startOffset = totalImages;

  const [slideIndex, setSlideIndex] = useState(startOffset);

  const startAutoPlay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIsTransitioning(true);
      setSlideIndex((prev) => prev + 1);
    }, 3000);
  }, []);

  const stopAutoPlay = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, [startAutoPlay, stopAutoPlay]);

  const handleTransitionEnd = useCallback(() => {
    if (slideIndex >= startOffset + totalImages) {
      setIsTransitioning(false);
      setSlideIndex(startOffset + (slideIndex % totalImages));
    } else if (slideIndex < startOffset) {
      setIsTransitioning(false);
      setSlideIndex(startOffset + ((slideIndex % totalImages) + totalImages) % totalImages);
    }
  }, [slideIndex, startOffset, totalImages]);

  useEffect(() => {
    if (!isTransitioning) {
      const frame = requestAnimationFrame(() => {
        setIsTransitioning(true);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [isTransitioning]);

  const goToSlide = (direction: "prev" | "next") => {
    stopAutoPlay();
    setIsTransitioning(true);
    setSlideIndex((prev) => (direction === "next" ? prev + 1 : prev - 1));
    startAutoPlay();
  };

  const openLightbox = (idx: number) => {
    const realIdx = ((idx - startOffset) % totalImages + totalImages) % totalImages;
    setLightboxIndex(realIdx);
    stopAutoPlay();
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    startAutoPlay();
  };

  const lightboxPrev = () => {
    setLightboxIndex((prev) => (prev === null ? 0 : (prev - 1 + totalImages) % totalImages));
  };

  const lightboxNext = () => {
    setLightboxIndex((prev) => (prev === null ? 0 : (prev + 1) % totalImages));
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") lightboxPrev();
      if (e.key === "ArrowRight") lightboxNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex]);

  const slideWidth = 100 / 3;

  return (
    <section className="py-16 sm:py-20" data-testid="section-hospital-glance">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-center mb-12">
          Hospital, at a Glance
        </h2>
        <div className="relative group">
          <div className="overflow-hidden rounded-lg">
            <div
              className={`flex ${isTransitioning ? "transition-transform duration-700 ease-in-out" : ""}`}
              style={{
                transform: `translateX(-${slideIndex * slideWidth}%)`,
              }}
              onTransitionEnd={handleTransitionEnd}
            >
              {extendedImages.map((image, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 px-2 cursor-pointer"
                  style={{ width: `${slideWidth}%` }}
                  onClick={() => openLightbox(idx)}
                  data-testid={`carousel-image-${idx}`}
                >
                  <div className="relative overflow-hidden rounded-lg aspect-[16/10]">
                    <img
                      src={image.src}
                      alt={image.label}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="text-white text-sm font-medium">{image.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full shadow-md"
            onClick={() => goToSlide("prev")}
            data-testid="carousel-prev"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full shadow-md"
            onClick={() => goToSlide("next")}
            data-testid="carousel-next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          data-testid="lightbox-overlay"
        >
          <div
            className="relative max-w-5xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-12 right-0 text-white hover:bg-white/20 z-10"
              onClick={closeLightbox}
              data-testid="lightbox-close"
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="relative">
              <img
                src={images[lightboxIndex].src}
                alt={images[lightboxIndex].label}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                data-testid="lightbox-image"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
                <p className="text-white text-lg font-medium text-center">
                  {images[lightboxIndex].label}
                </p>
                <p className="text-white/60 text-sm text-center mt-1">
                  {lightboxIndex + 1} / {totalImages}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-8 mt-6">
              <Button
                variant="outline"
                size="icon"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full h-12 w-12"
                onClick={lightboxPrev}
                data-testid="lightbox-prev"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 rounded-full h-12 w-12"
                onClick={lightboxNext}
                data-testid="lightbox-next"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
