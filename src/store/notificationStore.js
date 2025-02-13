import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      enabled: true,
      silent: false,
      currentNotification: null,

      setNotificationSettings: (enabled, silent = false) => {
        set({ enabled, silent })
      },

      notify: (title, message) => {
        const { enabled, silent, currentNotification } = get()
        
        if (!enabled) return
        if (!("Notification" in window)) return
        
        if (Notification.permission === "granted") {
          if (currentNotification) currentNotification.close()
          
          const notification = new Notification(title, {
            body: message,
            icon: "./icons/icon192.png",
            silent
          })
          
          set({ currentNotification: notification })
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then(permission => {
            if (permission === "granted") {
              const notification = new Notification(title, {
                body: message,
                icon: "./icons/icon192.png",
                silent
              })
              
              set({ currentNotification: notification })
            }
          })
        }
      },

      setup: () => {
        if ("Notification" in window) {
          if (Notification.permission !== "denied" && Notification.permission !== "granted") {
            Notification.requestPermission()
          }
        }
      }
    }),
    {
      name: 'gomodoro-notifications'
    }
  )
) 