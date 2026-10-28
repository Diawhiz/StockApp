import { createNavigationContainerRef } from '@react-navigation/native';

export const navRef = createNavigationContainerRef();

export function goToVendorDetail(vendorId) {
  if (navRef.isReady()) {
    navRef.navigate('VendorDetail', { vendorId });
  }
}
