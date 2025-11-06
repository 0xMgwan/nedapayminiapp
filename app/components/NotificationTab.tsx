import { useState, useEffect } from 'react';
import { FaBell, FaTrash, FaTimes, FaExternalLinkAlt, FaCopy, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';
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

type CombinedNotification = (NotificationItem | DatabaseNotification) & {
  displayTimestamp: string;
  isLocal: boolean;
  read: boolean;
};

interface DatabaseNotification {
  id: string;
  message: string;
  recipient: string;
  type: string;
  status: 'seen' | 'unseen';
  createdAt: string;
  relatedTransactionId?: string;
  relatedTransaction?: {
    id: string;
    merchantId: string;
    wallet: string;
    amount: string;
    currency: string;
    status: string;
    txHash?: string;
    orderId?: string;
    blockHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    gasPrice?: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface OffRampTransactionDetails {
  id: string;
  createdAt: string;
  merchantId: string;
  status: string;
  amount: string;
  currency: string;
  accountName: string;
  accountNumber: string;
  institution: string;
}

export default function NotificationTab() {
  const [open, setOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>([]);
  const [dbNotifications, setDbNotifications] = useState<DatabaseNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<DatabaseNotification['relatedTransaction'] | null>(null);
  const [selectedOffRampTransaction, setSelectedOffRampTransaction] = useState<OffRampTransactionDetails | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showOffRampModal, setShowOffRampModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { wallets } = useWallets();
  
  const userAddress = wallets?.[0]?.address;

  // Copy to clipboard utility
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // Format number with commas
  const formatNumber = (num: string | number): string => {
    const numStr = typeof num === 'string' ? num : num.toString();
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'confirmed':
      case 'settled':
        return { icon: FaCheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
      case 'failed':
      case 'error':
      case 'rejected':
        return { icon: FaTimesCircle, color: 'text-red-600', bg: 'bg-red-100' };
      case 'pending':
      case 'processing':
        return { icon: FaExclamationTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100' };
      case 'refunded':
        return { icon: FaCheckCircle, color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'expired':
        return { icon: FaTimesCircle, color: 'text-orange-600', bg: 'bg-orange-100' };
      default:
        return { icon: FaExclamationTriangle, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  // Fetch database notifications
  const fetchDbNotifications = async () => {
    if (!userAddress) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications?recipient=${userAddress}&limit=50`);
      if (response.ok) {
        const notifications = await response.json();
        console.log('Fetched notifications:', notifications);
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
  const handleNotificationClick = async (notification: CombinedNotification) => {
    console.log('Notification clicked:', notification);
    
    if ('status' in notification && notification.status === 'unseen') {
      await markDbNotificationAsSeen(notification.id);
      // Update local state
      setDbNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, status: 'seen' } : n)
      );
    }

    // Check if this is an offramp notification
    if ('type' in notification && notification.type === 'offramp' && 'relatedTransactionId' in notification && notification.relatedTransactionId) {
      console.log('Fetching offramp transaction details for ID:', notification.relatedTransactionId);
      try {
        const response = await fetch(`/api/offrampTransactions?transactionId=${notification.relatedTransactionId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.transactions && result.data.transactions.length > 0) {
            const offrampTx = result.data.transactions[0];
            console.log('Offramp transaction details:', offrampTx);
            setSelectedOffRampTransaction(offrampTx);
            setShowOffRampModal(true);
          } else {
            alert(`Notification: ${notification.message}\nTime: ${notification.displayTimestamp}\n\nTransaction details not available.`);
          }
        } else {
          console.error('Failed to fetch offramp transaction details');
          alert(`Notification: ${notification.message}\nTime: ${notification.displayTimestamp}\n\nFailed to load transaction details.`);
        }
      } catch (error) {
        console.error('Error fetching offramp transaction:', error);
        alert(`Notification: ${notification.message}\nTime: ${notification.displayTimestamp}\n\nError loading transaction details.`);
      }
    }
    // Show regular transaction details if available
    else if ('relatedTransaction' in notification && notification.relatedTransaction) {
      console.log('Opening transaction modal with data:', notification.relatedTransaction);
      setSelectedTransaction(notification.relatedTransaction);
      setShowTransactionModal(true);
    } else {
      console.log('No related transaction data found for notification:', notification);
      // If no transaction data, show a simple alert for now
      alert(`Notification: ${notification.message}\nTime: ${notification.displayTimestamp}`);
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
  const allNotifications: CombinedNotification[] = [
    ...localNotifications.map(n => ({ 
      ...n, 
      createdAt: n.timestamp, 
      isLocal: true,
      displayTimestamp: n.timestamp
    })),
    ...dbNotifications.map(n => ({ 
      ...n, 
      read: n.status === 'seen', 
      isLocal: false,
      displayTimestamp: new Date(n.createdAt).toLocaleString()
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
                  <p className="font-semibold text-slate-700 mb-2">No notifications</p>
                  <p className="text-sm text-slate-500">TESTING-12345-Send stablecoins to mobile money/bank instantly. Pay bills with stables instantly</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {allNotifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer group ${
                        !notification.read ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      } ${
                        (('relatedTransaction' in notification && notification.relatedTransaction) || 
                         ('type' in notification && notification.type === 'offramp' && 'relatedTransactionId' in notification && notification.relatedTransactionId))
                          ? 'hover:bg-blue-50 border-r-2 border-r-blue-300' 
                          : ''
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
                                : notification.type === 'offramp'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                              {notification.type || 'general'}
                            </span>
                            {'isLocal' in notification && notification.isLocal && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                                local
                              </span>
                            )}
                            {!notification.isLocal && (
                              (('relatedTransaction' in notification && notification.relatedTransaction) || 
                               ('type' in notification && notification.type === 'offramp' && 'relatedTransactionId' in notification && notification.relatedTransactionId))
                            ) && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                                <FaExternalLinkAlt className="w-2 h-2" />
                                details
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-900 mb-1 break-words">
                            {notification.message}
                          </div>
                          <div className="text-xs text-slate-500">
                            {notification.displayTimestamp}
                          </div>
                        </div>
                        <button
                          className="opacity-0 !group-hover:opacity-100 p-1 hover:!bg-red-100 !rounded-full transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            if ('isLocal' in notification && notification.isLocal) {
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

      {/* OffRamp Transaction Details Modal */}
      {showOffRampModal && selectedOffRampTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${getStatusDisplay(selectedOffRampTransaction.status).bg}`}>
                    {(() => {
                      const StatusIcon = getStatusDisplay(selectedOffRampTransaction.status).icon;
                      return <StatusIcon className={`w-5 h-5 ${getStatusDisplay(selectedOffRampTransaction.status).color}`} />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Off-Ramp Transaction Details</h2>
                    <p className="text-sm text-gray-500">
                      {new Date(selectedOffRampTransaction.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOffRampModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FaTimes className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Transaction Summary */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(selectedOffRampTransaction.amount)} {selectedOffRampTransaction.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const StatusIcon = getStatusDisplay(selectedOffRampTransaction.status).icon;
                        return <StatusIcon className={`w-4 h-4 ${getStatusDisplay(selectedOffRampTransaction.status).color}`} />;
                      })()}
                      <span className={`text-sm font-semibold capitalize ${getStatusDisplay(selectedOffRampTransaction.status).color}`}>
                        {selectedOffRampTransaction.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider/Institution */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Provider / Institution</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedOffRampTransaction.institution}
                  </p>
                </div>

                {/* Transaction ID */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">Transaction ID</p>
                    <button
                      onClick={() => copyToClipboard(selectedOffRampTransaction.id, 'offrampId')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copiedField === 'offrampId' ? (
                        <FaCheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <FaCopy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm font-mono text-gray-900 break-all">
                    {selectedOffRampTransaction.id}
                  </p>
                </div>

                {/* Account Name */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Account Name</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedOffRampTransaction.accountName}
                  </p>
                </div>

                {/* Account Number */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-600">Account Number</p>
                    <button
                      onClick={() => copyToClipboard(selectedOffRampTransaction.accountNumber, 'accountNumber')}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copiedField === 'accountNumber' ? (
                        <FaCheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <FaCopy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm font-mono text-gray-900">
                    {selectedOffRampTransaction.accountNumber}
                  </p>
                </div>
              </div>

              {/* Merchant Wallet */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">Merchant Wallet</p>
                  <button
                    onClick={() => copyToClipboard(selectedOffRampTransaction.merchantId, 'merchantWallet')}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {copiedField === 'merchantWallet' ? (
                      <FaCheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <FaCopy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {selectedOffRampTransaction.merchantId}
                </p>
              </div>

              {/* Date Information */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-600 mb-2">Transaction Date</p>
                <p className="text-sm text-gray-900">
                  {new Date(selectedOffRampTransaction.createdAt).toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowOffRampModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {showTransactionModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${getStatusDisplay(selectedTransaction.status).bg}`}>
                    {(() => {
                      const StatusIcon = getStatusDisplay(selectedTransaction.status).icon;
                      return <StatusIcon className={`w-5 h-5 ${getStatusDisplay(selectedTransaction.status).color}`} />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
                    <p className="text-sm text-gray-500">
                      {new Date(selectedTransaction.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <FaTimes className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Transaction Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(selectedTransaction.amount)} {selectedTransaction.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const StatusIcon = getStatusDisplay(selectedTransaction.status).icon;
                        return <StatusIcon className={`w-4 h-4 ${getStatusDisplay(selectedTransaction.status).color}`} />;
                      })()}
                      <span className={`text-sm font-semibold capitalize ${getStatusDisplay(selectedTransaction.status).color}`}>
                        {selectedTransaction.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Order ID */}
                {selectedTransaction.orderId && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-600">Order ID</p>
                      <button
                        onClick={() => copyToClipboard(selectedTransaction.orderId!, 'orderId')}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {copiedField === 'orderId' ? (
                          <FaCheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <FaCopy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm font-mono text-gray-900 break-all">
                      {selectedTransaction.orderId}
                    </p>
                  </div>
                )}

                {/* Transaction Hash */}
                {selectedTransaction.txHash && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-600">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(selectedTransaction.txHash!, 'txHash')}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {copiedField === 'txHash' ? (
                            <FaCheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <FaCopy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <a
                          href={`https://basescan.org/tx/${selectedTransaction.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <FaExternalLinkAlt className="w-4 h-4 text-blue-600" />
                        </a>
                      </div>
                    </div>
                    <p className="text-sm font-mono text-gray-900 break-all">
                      {selectedTransaction.txHash}
                    </p>
                  </div>
                )}

                {/* Block Hash */}
                {selectedTransaction.blockHash && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-600">Block Hash</p>
                      <button
                        onClick={() => copyToClipboard(selectedTransaction.blockHash!, 'blockHash')}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        {copiedField === 'blockHash' ? (
                          <FaCheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <FaCopy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm font-mono text-gray-900 break-all">
                      {selectedTransaction.blockHash}
                    </p>
                  </div>
                )}

                {/* Block Number */}
                {selectedTransaction.blockNumber && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Block Number</p>
                    <p className="text-sm font-mono text-gray-900">
                      #{formatNumber(selectedTransaction.blockNumber)}
                    </p>
                  </div>
                )}

                {/* Gas Used */}
                {selectedTransaction.gasUsed && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Gas Used</p>
                    <p className="text-sm font-mono text-gray-900">
                      {formatNumber(selectedTransaction.gasUsed)}
                    </p>
                  </div>
                )}

                {/* Gas Price */}
                {selectedTransaction.gasPrice && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Gas Price</p>
                    <p className="text-sm font-mono text-gray-900">
                      {formatNumber(selectedTransaction.gasPrice)} Gwei
                    </p>
                  </div>
                )}
              </div>

              {/* Wallet Information */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">Wallet Address</p>
                  <button
                    onClick={() => copyToClipboard(selectedTransaction.wallet, 'wallet')}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    {copiedField === 'wallet' ? (
                      <FaCheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <FaCopy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
                <p className="text-sm font-mono text-gray-900 break-all">
                  {selectedTransaction.wallet}
                </p>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Created At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-600 mb-2">Updated At</p>
                  <p className="text-sm text-gray-900">
                    {new Date(selectedTransaction.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl">
              <div className="flex justify-end gap-3">
                {selectedTransaction.txHash && (
                  <a
                    href={`https://basescan.org/tx/${selectedTransaction.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    <FaExternalLinkAlt className="w-4 h-4" />
                    View on BaseScan
                  </a>
                )}
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}