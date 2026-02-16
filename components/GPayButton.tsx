import React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { GPayIcon } from './icons';

interface GPayButtonProps {
  onPaymentSuccess: () => void;
}

export const GPayButton: React.FC<GPayButtonProps> = ({ onPaymentSuccess }) => {
  const handlePayment = () => {
    // Simulate G-Pay payment
    const promise = new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve('Success');
        } else {
          reject(new Error('Payment failed'));
        }
      }, 2000);
    });

    toast.promise(
      promise,
      {
        loading: 'Otwieram G-Pay...',
        success: 'Płatność G-Pay zakończona pomyślnie!',
        error: 'Płatność G-Pay nie powiodła się.',
      }
    ).then(() => {
      onPaymentSuccess();
    }).catch(() => {
      // Error toast is already shown by toast.promise
    });
  };

  return (
    <motion.button
      onClick={handlePayment}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="capsule-button capsule-light flex items-center justify-center space-x-2 w-full text-sm py-1"
    >
      <GPayIcon />
      <span className="font-bold">Pay</span>
    </motion.button>
  );
};