"use client"

import { useEffect, useState, useRef } from "react"
import scrollImg1 from "@/assets/scroll-img-1.png"
import scrollImg2 from "@/assets/scroll-img-2.png"
import scrollImg3 from "@/assets/scroll-img-3.png"
import scrollImg4 from "@/assets/scroll-img-4.png"
import scrollImg5 from "@/assets/scroll-img-5.png"

export function ScrollingAnimation() {
  const containerRef = useRef(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      // Scroll value relative to the container entering the viewport:
      // When rect.top is 0, sticky starts. When rect.top is negative, we've scrolled inside.
      const scrolled = -rect.top
      const containerHeight = rect.height
      const viewportHeight = window.innerHeight
      const totalScrollable = containerHeight - viewportHeight

      // Clamp scroll value between 0 and the total scrollable height of this section
      const clampedScroll = Math.max(0, Math.min(scrolled, totalScrollable))
      setScrollY(clampedScroll)
    }

    window.addEventListener("scroll", handleScroll)
    // Run initially to capture starting position
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const animationProgress = Math.min(scrollY / 500, 1)
  const expandRadius = animationProgress * 300

  return (
    <div ref={containerRef} className="min-h-[200vh] bg-background">
      <div className="h-screen flex items-center justify-center p-8 sticky top-0 overflow-hidden">
        <div className="relative">
          <div
            className={`w-[600px] h-[600px] rounded-full flex items-center justify-center transition-all duration-500 ${
              scrollY > 300 ? "border-2 border-border dark:border-gray-700" : ""
            }`}
          >
            <div
              className={`w-[500px] h-[500px] rounded-full flex items-center justify-center relative transition-all duration-500 ${
                scrollY > 100 ? "border-2 border-blue-100 dark:border-blue-800" : ""
              }`}
            >
              <div className="w-[400px] h-[400px] rounded-full bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 dark:from-purple-600 dark:via-pink-600 dark:to-red-600 p-0.5 flex items-center justify-center relative">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center relative">
                  
                  {/* Profile 1 */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos(0)}px, ${expandRadius * Math.sin(0)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg1}
                      alt="Illustration 1"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 2 */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos(Math.PI / 4)}px, ${expandRadius * Math.sin(Math.PI / 4)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg2}
                      alt="Illustration 2"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 3 */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos(Math.PI / 2)}px, ${expandRadius * Math.sin(Math.PI / 2)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg3}
                      alt="Illustration 3"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 4 */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos((3 * Math.PI) / 4)}px, ${expandRadius * Math.sin((3 * Math.PI) / 4)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg4}
                      alt="Illustration 4"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 5 */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos(Math.PI)}px, ${expandRadius * Math.sin(Math.PI)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg5}
                      alt="Illustration 5"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 6 (repeat img 1) */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos((5 * Math.PI) / 4)}px, ${expandRadius * Math.sin((5 * Math.PI) / 4)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg1}
                      alt="Illustration 6"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 7 (repeat img 2) */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos((3 * Math.PI) / 2)}px, ${expandRadius * Math.sin((3 * Math.PI) / 2)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg2}
                      alt="Illustration 7"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Profile 8 (repeat img 3) */}
                  <div
                    className="absolute w-24 h-24 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg transition-transform duration-300 ease-out z-0 bg-muted"
                    style={{
                      transform: `translate(${expandRadius * Math.cos((7 * Math.PI) / 4)}px, ${expandRadius * Math.sin((7 * Math.PI) / 4)}px)`,
                    }}
                  >
                    <img
                      src={scrollImg3}
                      alt="Illustration 8"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div
                    className={`flex flex-col items-center justify-center relative z-20 transition-opacity duration-500 ${
                      scrollY > 250 ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <h1 className="text-4xl font-bold text-foreground text-center mb-2">Empowering</h1>
                    <h1 className="text-4xl font-bold text-foreground text-center mb-4">Every User</h1>

                    <p className="text-muted-foreground text-center max-w-xs">
                      From entrepreneurs to educators, Gen AI provides tools to simplify work.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
