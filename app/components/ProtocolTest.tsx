'use client';

import { useState, useEffect } from 'react';
import { 
  calculateDynamicFee, 
  formatFeeInfo, 
  getProtocolStatus,
  isProtocolEnabled 
} from '../utils/nedaPayProtocol';

export default function ProtocolTest() {
  const [testAmount, setTestAmount] = useState(250);
  const [feeInfo, setFeeInfo] = useState<any>(null);
  const [protocolStatus, setProtocolStatus] = useState<any>(null);

  useEffect(() => {
    // Calculate fee info
    const fee = calculateDynamicFee(testAmount);
    setFeeInfo(fee);
    
    // Get protocol status
    const status = getProtocolStatus();
    setProtocolStatus(status);
  }, [testAmount]);

  if (!isProtocolEnabled()) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
        <strong>Protocol Disabled:</strong> Add <code>NEXT_PUBLIC_ENABLE_PROTOCOL=true</code> to your .env file to enable testing.
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-4">🧪 NedaPay Protocol Test</h3>
      
      {/* Protocol Status */}
      <div className="mb-4 p-3 bg-green-100 rounded">
        <h4 className="font-medium text-green-800">Protocol Status</h4>
        <p className="text-sm text-green-700">
          ✅ Enabled: {protocolStatus?.enabled ? 'Yes' : 'No'}<br/>
          🌐 Network: {protocolStatus?.network}<br/>
          📍 Address: <code className="text-xs">{protocolStatus?.address}</code>
        </p>
      </div>

      {/* Fee Calculator Test */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Test Amount (USD):
        </label>
        <input
          type="number"
          value={testAmount}
          onChange={(e) => setTestAmount(Number(e.target.value))}
          className="border rounded px-3 py-2 w-32"
          min="1"
          max="10000"
        />
      </div>

      {/* Fee Results */}
      {feeInfo && (
        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium mb-2">Dynamic Fee Calculation:</h4>
          <div className="space-y-1 text-sm">
            <p><strong>Amount:</strong> ${testAmount.toFixed(2)}</p>
            <p><strong>Fee:</strong> ${feeInfo.feeAmount.toFixed(4)} ({feeInfo.feeRate}%)</p>
            <p><strong>Net Amount:</strong> ${(testAmount - feeInfo.feeAmount).toFixed(2)}</p>
            <p><strong>Tier:</strong> {feeInfo.tier}</p>
            <p><strong>Formatted:</strong> {formatFeeInfo(testAmount)}</p>
          </div>
        </div>
      )}

      {/* Fee Tier Examples */}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Fee Tier Examples:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {[50, 250, 1000, 3000, 7000].map(amount => {
            const fee = calculateDynamicFee(amount);
            return (
              <div key={amount} className="bg-blue-50 p-2 rounded">
                ${amount} → ${fee.feeAmount.toFixed(2)} ({fee.feeRate}%)
              </div>
            );
          })}
        </div>
      </div>

      {/* Test Instructions */}
      <div className="mt-4 p-3 bg-blue-100 rounded">
        <h4 className="font-medium text-blue-800">Test Instructions:</h4>
        <ol className="text-sm text-blue-700 mt-1 space-y-1">
          <li>1. Try different amounts to see fee tiers change</li>
          <li>2. Check that fees decrease as amounts increase</li>
          <li>3. Verify contract address matches deployment</li>
          <li>4. Test with actual transactions (small amounts first)</li>
        </ol>
      </div>
    </div>
  );
}
