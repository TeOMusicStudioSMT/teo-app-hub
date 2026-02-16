// FIX: Add missing React import to use React.FC type.
import React from 'react';
import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { projectsAtom } from '../store';
import toast from 'react-hot-toast';

const SubscriptionActivator: React.FC = () => {
    const [, setProjects] = useAtom(projectsAtom);
    const tokenProcessed = useRef(false);

    useEffect(() => {
        if (tokenProcessed.current) return;

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token === 'magic_library_access') {
            tokenProcessed.current = true;
            toast.loading('Verifying activation token...');
            
            // Simulate API call to verify subscription
            setTimeout(() => {
                setProjects(currentProjects => {
                    const projectToUpdate = currentProjects.find(p => p.id === 'teostory.studio');
                    
                    if (projectToUpdate && !projectToUpdate.isSubscribed) {
                        toast.dismiss();
                        toast.success('Magic Library access activated successfully!');
                        return currentProjects.map(p =>
                            p.id === 'teostory.studio' ? { ...p, isSubscribed: true } : p
                        );
                    } else {
                         toast.dismiss();
                         toast('Magic Library access is already active.', { icon: 'ℹ️' });
                         return currentProjects; // Return unchanged state
                    }
                });
                 // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 2500); // Simulate network delay
        }
    }, [setProjects]);

    return null; // This component does not render anything visible.
};

export default SubscriptionActivator;