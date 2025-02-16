import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useNotificationStore = create(
  persist(
    (set, get) => ({
      enabled: true,
      silent: false,
      currentNotification: null,

      setNotificationSettings: (enabled, silent = false) => {
        console.log('Setting notification settings:', { enabled, silent })
        set({ enabled, silent })
      },

      notify: (title, message) => {
        const { enabled, silent } = get()
        console.log('Notification triggered:', { title, message, enabled, silent })
        
        // Don't show notification if page is visible
        if (document.visibilityState === 'visible') {
          console.log('Page is visible, skipping notification')
          return
        }
        
        if (!enabled) {
          console.log('Notifications are disabled')
          return
        }

        if (!("Notification" in window)) {
          console.log('Notifications not supported in this browser')
          return
        }
        
        console.log('Current notification permission:', Notification.permission)
        
        if (Notification.permission === "granted") {
          // Close any existing notification without relying on persisted state
          const prevNotification = get().currentNotification
          if (prevNotification && typeof prevNotification.close === 'function') {
            console.log('Closing previous notification')
            try {
              prevNotification.close()
            } catch (e) {
              console.warn('Error closing previous notification:', e)
            }
          }
          
          console.log('Creating new notification')
          try {
            const notification = new Notification(title, {
              body: message,
              icon: "./icons/icon192.png",
              silent,
              requireInteraction: true // Keep notification until user interacts
            })
            
            // Add click handler to focus window
            notification.addEventListener('click', () => {
              console.log('Notification clicked, focusing window')
              window.focus()
              notification.close()
            })
            
            // Store notification reference without persisting
            set({ currentNotification: notification })
          } catch (e) {
            console.error('Error creating notification:', e)
          }
        } else if (Notification.permission !== "denied") {
          console.log('Requesting notification permission')
          Notification.requestPermission().then(permission => {
            console.log('Permission response:', permission)
            if (permission === "granted") {
              try {
                const notification = new Notification(title, {
                  body: message,
                  icon: "./icons/icon192.png",
                  silent,
                  requireInteraction: true // Keep notification until user interacts
                })
                
                // Add click handler to focus window
                notification.addEventListener('click', () => {
                  console.log('Notification clicked, focusing window')
                  window.focus()
                  notification.close()
                })
                
                // Store notification reference without persisting
                set({ currentNotification: notification })
              } catch (e) {
                console.error('Error creating notification:', e)
              }
            }
          })
        }
      },

      setup: () => {
        console.log('Setting up notifications')
        if ("Notification" in window) {
          console.log('Current notification permission:', Notification.permission)
          if (Notification.permission !== "denied" && Notification.permission !== "granted") {
            console.log('Requesting initial notification permission')
            Notification.requestPermission().then(permission => {
              console.log('Initial permission response:', permission)
            })
          }
        } else {
          console.log('Notifications not supported in this browser')
        }

        // Clear any stale notification reference on setup
        set({ currentNotification: null })
      }
    }),
    {
      name: 'gomodoro-notifications',
      // Don't persist the notification object since it can't be serialized
      partialize: (state) => ({
        enabled: state.enabled,
        silent: state.silent
      })
    }
  )
) 