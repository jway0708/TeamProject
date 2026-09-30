import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-homepage',
  templateUrl: './homepage.page.html',
  styleUrls: ['./homepage.page.scss'],
  standalone: false,
})
export class HomepagePage implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {}

  // Function for the Show QR button
  showQRCode() {
    console.log('Show QR clicked');
    // Implement your QR modal or view logic here
  }

  // Function for the notifications button
  openNotifications() {
    console.log('Notifications clicked');
    // Implement notification drawer or routing here
  }

  // Function for redeeming rewards
  redeemReward(rewardName: string) {
    console.log(`Redeeming reward: ${rewardName}`);
    // Implement reward redemption service call here
  }

}