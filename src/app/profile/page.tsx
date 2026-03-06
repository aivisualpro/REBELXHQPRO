'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ProfileRedirect() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;

        if (!session) {
            router.replace('/login');
            return;
        }

        const profileId = (session.user as any)?.profileId;
        if (profileId) {
            router.replace(`/profile/${profileId}`);
        } else {
            // Fallback: use _id for users without profileId (master admin)
            const userId = (session.user as any)?.id;
            if (userId) {
                router.replace(`/profile/${userId}`);
            }
        }
    }, [session, status, router]);

    return (
        <div className="flex items-center justify-center h-full bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
    );
}
