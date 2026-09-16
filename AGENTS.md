Hello,

The issues we previously identified still need your attention. We also found new issues that need to be addressed. 

If you have any questions, we are here to help. Reply to this message in App Store Connect and let us know.

Review Environment
Submission ID: c3817e00-87f7-4681-9e52-78d01b4f6430
Review date: May 26, 2026
Review Device: iPad Air 11-inch (M3)
Version reviewed: 1.0 (14)

Guideline 5.1.2(i) - Legal - Privacy - Data Use and Sharing

Issue Description

The app does not use App Tracking Transparency to request the user's permission before tracking their activity.

Apps need to receive the user’s permission through the AppTrackingTransparency framework before collecting data used to track them. This requirement protects the privacy of users.

Next Steps

Here are three ways to resolve this issue:

- If the app does not currently track, update the app privacy information in App Store Connect. You must have the Account Holder or Admin role to update app privacy information. If you are unable to change the privacy label, reply to this message in App Store Connect, and make sure your App Privacy Information in App Store Connect is up to date before submitting your next update for review.

- If this app does not track on the platform associated with this submission, but tracks on other platforms, notify App Review by replying to the rejection in App Store Connect. You should also reply if this app does not track on the platform associated with this submission but tracks on other Apple platforms this app is available on.

- If the app tracks users on all supported platforms, the app must use App Tracking Transparency to request permission before collecting data used to track. When resubmitting, indicate in the Review Notes where the permission request is located.

Note that if the app behaves differently in different countries or regions, you should provide a way for App Review to review these variations in the app submission. Additionally, these differences should be documented in the Review Notes section of App Store Connect.

Resources

- Tracking is linking data collected from the app with third-party data for advertising purposes, or sharing the collected data with a data broker. Learn more about tracking. 
- See Frequently Asked Questions about the requirements for apps that track users.
- Learn more about designing appropriate permission requests.
Guideline 2.3.10 - Performance - Accurate Metadata
Issue Description

The app or metadata includes information about third-party platforms that may not be relevant for App Store users, who are focused on experiences offered by the app itself.

See attached screenshot(s) for details.

Next Steps

Revise the app's screenshots to remove non-iOS status bar images. 

Revised screenshots should accurately reflect the app in use on the supported devices and highlight the app's main features in the majority of the screenshots. Note some screenshots may only be viewed and updated by selecting "View All Sizes in Media Manager" in the Previews and Screenshots section of App Store Connect. 

Reply to App Review in App Store Connect with additional information if the app's functionality and how it interacts with third-party platforms has been misunderstood.

Resources

Learn how to edit App Store metadata on App Store Connect Help.
Guideline 2.1 - Information Needed

The app binary includes the PassKit framework for implementing Apple Pay, but we were unable to verify any integration of Apple Pay within the app.

See attached screenshot(s) for details.

Next Steps

If the app integrates the functionality referenced above, indicate where in the app we can locate it.

If the app does not include this functionality, indicate this information in the Review Notes section for each version of the app in App Store Connect when submitting for review.
Support
- Reply to this message in your preferred language if you need assistance. If you need additional support, use the Contact Us module.
- Consult with fellow developers and Apple engineers on the Apple Developer Forums.
- Request an App Review Appointment at Meet with Apple to discuss your app's review. Appointments subject to availability during your local business hours on Tuesdays and Thursdays.
- Provide feedback on this message and your review experience by completing a short survey.