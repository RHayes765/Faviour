import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Lookup: { profileFilterId?: string } | undefined;
  Profiles: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  AddItem:
    | { itemId?: string; prefillName?: string; prefillBarcode?: string }
    | undefined;
};
