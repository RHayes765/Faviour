import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Lookup: { profileFilterId?: string } | undefined;
  Profiles: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  AddItem:
    | {
        itemId?: string;
        prefillName?: string;
        prefillBarcode?: string;
        /** Set by ScanScreen when returning from capture mode. */
        scannedBarcode?: string;
      }
    | undefined;
  Scan: { mode?: 'capture' } | undefined;
  ItemDetail: { itemId: string };
};
