import { useColorScheme } from 'react-native';
const light={background:'#F5F6F4',surface:'#FFFFFF',elevated:'#EBEDE8',text:'#151713',secondary:'#696E65',border:'#DDE0D8',accent:'#36C875',accentDark:'#126A3A',danger:'#D94545',input:'#F0F2EE',tab:'#FFFFFF',shadow:'#000000'};
const dark={background:'#0F110F',surface:'#191C18',elevated:'#242824',text:'#F3F5F0',secondary:'#A4AAA0',border:'#32372F',accent:'#49DD88',accentDark:'#86F2B3',danger:'#FF6B6B',input:'#252925',tab:'#171A17',shadow:'#000000'};
export type Theme=typeof light;
export const useTheme=():Theme=>useColorScheme()==='dark'?dark:light;
