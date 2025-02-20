"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Spinner } from "@/components/ui/spinner"

const LoadingMapOverlay: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const [displayText, setDisplayText] = useState("地図を読み込み中")
  const [showOverlay, setShowOverlay] = useState(isVisible)

  useEffect(() => {
    if (isVisible) {
      setShowOverlay(true)
      setDisplayText("地図を読み込み中")
    } else {
      setDisplayText("地図の読み込み完了")
      setTimeout(() => {
        setShowOverlay(false)
      }, 1000)
    }
  }, [isVisible])

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            transition: {
              duration: 1,
              ease: [0.19, 1, 0.22, 1]
            }
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-white/80 dark:bg-black/50 border rounded-lg flex items-center justify-center px-4 py-2"
        >
          <motion.div 
            className="flex items-center"
            initial={false}
          >
            <motion.div
              initial={false}
              animate={{
                opacity: isVisible ? 1 : 0,
                width: isVisible ? "24px" : "0px",
                marginRight: isVisible ? "10px" : "0px",
              }}
              transition={{
                duration: 1,
                ease: [0.19, 1, 0.22, 1]
              }}
              className="overflow-hidden flex items-center justify-center"
            >
              <Spinner size={24} />
            </motion.div>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
              className="whitespace-nowrap text-sm"
            >
              {displayText}
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export { LoadingMapOverlay }
