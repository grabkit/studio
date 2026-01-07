
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPolicyPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Privacy Policy</h2>
            </div>
            <div className="pt-14 p-4 space-y-4 prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p>
                    Welcome to Blur. Your privacy and anonymity are the foundation of our platform. This Privacy Policy explains what information we collect, how we use it, and how we protect it.
                </p>

                <h4 className="font-semibold">1. Our Commitment to Anonymity</h4>
                <p>
                    Blur is designed to be an anonymous social network. Your real name is not required, and your primary identifier is your randomly generated Blur ID. We do not publicly display any personal information you provide during signup, such as your email address.
                </p>
                
                <h4 className="font-semibold">2. Information We Collect</h4>
                <p>We collect information in a few different ways:</p>
                <ul>
                    <li>
                        <strong>Information You Provide:</strong> This includes the email address and password you use for registration. You may also voluntarily provide information in your profile, such as a bio, website link, or an avatar. Any content you create, like posts, comments, voice statuses, and messages, is also collected to be displayed on the platform.
                    </li>
                    <li>
                        <strong>Information Collected Automatically:</strong> We use Firebase services which may automatically log information like your device type, IP address, and usage activity (what features you use, what content you interact with). This data is used for analytics to improve the app and is not linked to your public anonymous identity.
                    </li>
                </ul>

                <h4 className="font-semibold">3. How We Use Your Information</h4>
                <p>We use the information we collect to:</p>
                <ul>
                    <li>Provide, operate, and maintain our services (e.g., authenticating your account).</li>
                    <li>Display your anonymous content (posts, comments, etc.) to other users.</li>
                    <li>Improve, personalize, and expand our services.</li>
                    <li>Understand and analyze how you use our services.</li>
                    <li>Communicate with you for account-related purposes, such as password resets.</li>
                    <li>Enforce our Terms of Service and address violations, such as by reviewing user reports.</li>
                </ul>

                <h4 className="font-semibold">4. Data Sharing and Disclosure</h4>
                <p>
                    <strong>We do not share, sell, rent, or trade your personally identifiable information (like your email address) with third parties for their commercial purposes.</strong>
                </p>
                <p>
                    Your anonymous content (posts, profile, etc.) is public to other users of the app. We may share information in the following limited circumstances:
                </p>
                <ul>
                    <li><strong>Legal Requirements:</strong> If required by law, we may disclose your information in response to a subpoena, court order, or other governmental request.</li>
                    <li><strong>Safety and Security:</strong> To protect the rights, property, or safety of Blur, our users, or the public.</li>
                </ul>


                <h4 className="font-semibold">5. Data Security</h4>
                <p>
                    We use Firebase Authentication and Firestore Security Rules to secure your account and data. While we take strong measures to protect your information, no online service can be 100% secure. We cannot guarantee the absolute security of your data.
                </p>
                
                <h4 className="font-semibold">6. Your Data Rights</h4>
                <p>
                    You can review and update your profile information through your account settings. You can also delete your posts and comments. Deleting your account will permanently remove your profile and associated content from our primary servers.
                </p>
                
                <h4 className="font-semibold">7. Children's Privacy</h4>
                <p>
                    Our service is not intended for children under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If we become aware that a child has provided us with personal information, we will take steps to delete such information.
                </p>

                <h4 className="font-semibold">8. Changes to This Policy</h4>
                <p>
                    We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
                </p>

                <h4 className="font-semibold">Contact Us</h4>
                <p>
                    If you have any questions about this Privacy Policy, you can contact us through the "Help" section in the app settings.
                </p>
            </div>
        </AppLayout>
    )
}
