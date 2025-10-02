import { useState, useEffect } from 'react';
import { FaBell, FaTrash, FaTimes } from 'react-icons/fa';
import { useWallets } from '@privy-io/react-auth';
import { addPaymentTransaction, PaymentTransaction } from '../utils/paymentStorage';

// Fallback UUID generator for environments without crypto.randomUUID
function uuidFallback() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface NotificationItem {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type?: string;
  isLocal?: boolean; // To distinguish between local and database notifications
}

interface DatabaseNotification {
  id: string;
  message: string;
  recipient: string;
  type: string;
  status: 'seen' | 'unseen';
  createdAt: string;
  relatedTransactionId?: string;
}

export default function NotificationTab() {
  const [open, setOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);
  const [dbNotifications, setDbNotifications] = useState<DatabaseNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { wallets } = useWallets();
  
  const userAddress = wallets?.[0]?.address;

  // Fetch database notifications
  const fetchDbNotifications = async () => {
    if (!userAddress) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?recipient=${userAddress}`);
      if (response.ok) {
        const notifications = await response.json();
        setDbNotifications(notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as seen in database
  const markDbNotificationAsSeen = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'seen' }),
      });
    } catch (error) {
      console.error('Failed to mark notification as seen:', error);
    }
  };

  // Mark all database notifications as seen
  const markAllDbNotificationsAsSeen = async () => {
    const unseenNotifications = dbNotifications.filter(n => n.status === 'unseen');
    
    try {
      await Promise.all(
        unseenNotifications.map(notification =>
          fetch(`/api/notifications?id=${notification.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'seen' }),
          })
        )
      );
      // Refresh notifications after marking as seen
      await fetchDbNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as seen:', error);
    }
  };

  // Delete database notification
  const deleteDbNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDbNotifications(prev => prev.filter(n => n.id !== notificationId));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Delete all database notifications
  const deleteAllDbNotifications = async () => {
    try {
      await Promise.all(
        dbNotifications.map(notification =>
          fetch(`/api/notifications?id=${notification.id}`, {
            method: 'DELETE',
          })
        )
      );
      setDbNotifications([]);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  // Listen for custom events to add local notifications (existing functionality)
  useEffect(() => {
    function handleNewNotification(e: CustomEvent) {
      setLocalNotifications((prev) => [
        {
          id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : uuidFallback(),
          message: e.detail.message,
          timestamp: new Date().toLocaleString(),
          read: false,
          type: e.detail.type || 'general',
          isLocal: true,
        },
        ...prev,
      ]);

      // Sync payment data with dashboard if notification is a payment
      if (e.detail && e.detail.type === 'payment' && e.detail.paymentData) {
        const tx: PaymentTransaction = {
          ...e.detail.paymentData,
          id: e.detail.paymentData.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidFallback()),
        };
        addPaymentTransaction(tx);
      }
    }
    window.addEventListener('neda-notification', handleNewNotification as EventListener);
    return () => window.removeEventListener('neda-notification', handleNewNotification as EventListener);
  }, []);

  // Fetch database notifications on component mount and when user address changes
  useEffect(() => {
    if (userAddress) {
      fetchDbNotifications();
    }
  }, [userAddress]);

  // Refresh database notifications when panel opens
  useEffect(() => {
    if (open && userAddress) {
      fetchDbNotifications();
    }
  }, [open, userAddress]);

  // Handle notification click (mark as seen for database notifications)
  const handleNotificationClick = async (notification: NotificationItem | DatabaseNotification) => {
    if ('status' in notification && notification.status === 'unseen') {
      await markDbNotificationAsSeen(notification.id);
      // Update local state
      setDbNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, status: 'seen' } : n)
      );
    }
  };

  // Mark all local notifications as read
  const markAllLocalRead = () => {
    setLocalNotifications((prev) => prev.map(n => ({ ...n, read: true })));
  };

  // Mark all notifications as read/seen
  const markAllRead = () => {
    markAllLocalRead();
    markAllDbNotificationsAsSeen();
  };

  // Delete local notification
  const deleteLocalNotification = (id: string) => {
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Delete all local notifications
  const deleteAllLocalNotifications = () => {
    setLocalNotifications([]);
  };

  // Delete all notifications
  const deleteAllNotifications = () => {
    deleteAllLocalNotifications();
    deleteAllDbNotifications();
  };

  // Calculate total unread/unseen count
  const unreadCount = localNotifications.filter(n => !n.read).length + 
                     dbNotifications.filter(n => n.status === 'unseen').length;

  // Combine and sort all notifications
  const allNotifications = [
    ...localNotifications.map(n => ({ ...n, createdAt: n.timestamp, isLocal: true })),
    ...dbNotifications.map(n => ({ 
      ...n, 
      read: n.status === 'seen', 
      timestamp: new Date(n.createdAt).toLocaleString(),
      isLocal: false 
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="relative">
      <button
        className="relative p-2 !rounded-full bg-white/20 backdrop-blur-sm hover:!bg-white/30 transition-colors duration-300 border border-white/30"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <FaBell size={18} className='text-white hover:text-blue-200 transition-colors duration-300'/>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[1.25rem] shadow-lg border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {/* Online indicator - green dot */}
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full shadow-lg"></span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 md:hidden" 
            onClick={() => setOpen(false)}
          />
          
          {/* Notification Panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-[70vh] md:max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-xs">Notifications</span>
                {loading && (
                  <div className="w-4 h-4 border-2 !border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {allNotifications.length > 0 && (
                  <>
                    <button 
                      className="!text-xs text-blue-600 hover:!underline !bg-blue-100 hover:!bg-blue-200 px-3 py-1.5 !rounded-full transition"
                      onClick={markAllRead}
                      disabled={unreadCount === 0}
                    >
                      Mark all read
                    </button>
                    <button 
                      className="!text-xs text-red-600 hover:!underline !bg-red-100 hover:!bg-red-200 px-3 py-1.5 !rounded-full transition"
                      onClick={deleteAllNotifications}
                    >
                      Clear all
                    </button>
                  </>
                )}
                <button
                  className="p-1.5 hover:!bg-slate-100 !rounded-full transition-colors border border-slate-200"
                  onClick={() => setOpen(false)}
                >
                  <FaTimes size={16} className="text-slate-600" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {allNotifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <FaBell size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No notifications yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {allNotifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer group ${
                        !notification.read ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              notification.type === 'payment' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {notification.type || 'general'}
                            </span>
                            {notification.isLocal && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                local
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-900 mb-1 break-words">
                            {notification.message}
                          </div>
                          <div className="text-xs text-slate-500">
                            {notification.timestamp}
                          </div>
                        </div>
                        <button
                          className="opacity-0 !group-hover:opacity-100 p-1 hover:!bg-red-100 !rounded-full transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notification.isLocal) {
                              deleteLocalNotification(notification.id);
                            } else {
                              deleteDbNotification(notification.id);
                            }
                          }}
                        >
                          <FaTrash size={12} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}