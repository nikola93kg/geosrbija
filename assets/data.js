// Rounds in order of difficulty. Coordinates: [lat, lon] (WGS84).
// River rounds point at polylines in GEO_MAP.rivers (scored by distance to the nearest point of the river).
var GEO_ROUNDS = [
  { name: 'Veliki gradovi', places: [
    ['Beograd', 44.817, 20.457], ['Novi Sad', 45.267, 19.833], ['Niš', 43.321, 21.896],
    ['Kragujevac', 44.012, 20.911], ['Subotica', 46.100, 19.667], ['Priština', 42.663, 21.165],
    ['Zrenjanin', 45.381, 20.389], ['Pančevo', 44.871, 20.640], ['Čačak', 43.891, 20.350],
    ['Kraljevo', 43.725, 20.689], ['Novi Pazar', 43.137, 20.512], ['Smederevo', 44.665, 20.928],
    ['Leskovac', 42.998, 21.946], ['Valjevo', 44.271, 19.890], ['Šabac', 44.756, 19.694],
    ['Užice', 43.858, 19.848], ['Kruševac', 43.580, 21.334], ['Vranje', 42.551, 21.900],
    ['Prizren', 42.214, 20.740], ['Sombor', 45.774, 19.112]
  ] },
  { name: 'Manji gradovi', places: [
    ['Sremska Mitrovica', 44.976, 19.612], ['Pirot', 43.153, 22.586], ['Zaječar', 43.904, 22.284],
    ['Kikinda', 45.829, 20.465], ['Vršac', 45.117, 21.303], ['Jagodina', 43.977, 21.261],
    ['Loznica', 44.534, 19.226], ['Bor', 44.075, 22.096], ['Prokuplje', 43.234, 21.588],
    ['Negotin', 44.226, 22.531], ['Požarevac', 44.620, 21.183], ['Paraćin', 43.861, 21.408],
    ['Aranđelovac', 44.307, 20.560], ['Gornji Milanovac', 44.026, 20.461], ['Prijepolje', 43.390, 19.648],
    ['Kosovska Mitrovica', 42.891, 20.866], ['Peć', 42.659, 20.288], ['Đakovica', 42.380, 20.431],
    ['Gnjilane', 42.464, 21.469], ['Bečej', 45.616, 20.034], ['Ruma', 45.008, 19.822],
    ['Knjaževac', 43.567, 22.257], ['Bačka Palanka', 45.250, 19.392], ['Senta', 45.927, 20.077],
    ['Kladovo', 44.607, 22.613], ['Ivanjica', 43.582, 20.230], ['Aleksinac', 43.541, 21.707],
    ['Sjenica', 43.273, 20.000], ['Uroševac', 42.370, 21.149], ['Trstenik', 43.617, 21.000]
  ] },
  { name: 'Manastiri', places: [
    ['Manastir Studenica', 43.486, 20.532], ['Manastir Žiča', 43.697, 20.646], ['Manastir Mileševa', 43.364, 19.719],
    ['Manastir Sopoćani', 43.144, 20.415], ['Manastir Ravanica', 43.964, 21.554], ['Manastir Manasija', 44.095, 21.468],
    ['Manastir Gračanica', 42.599, 21.193], ['Visoki Dečani', 42.547, 20.266], ['Pećka patrijaršija', 42.664, 20.265],
    ['Manastir Krušedol', 45.119, 19.943], ['Manastir Kalenić', 43.979, 21.025], ['Manastir Ljubostinja', 43.647, 21.072],
    ['Đurđevi stupovi', 43.148, 20.501], ['Manastir Tronoša', 44.430, 19.300], ['Manastir Rača', 43.948, 19.528],
    ['Manastir Prohor Pčinjski', 42.335, 21.912], ['Manastir Gornjak', 44.278, 21.537], ['Manastir Bogovađa', 44.318, 20.187]
  ] },
  { name: 'Planine', places: [
    ['Kopaonik', 43.274, 20.825], ['Zlatibor', 43.700, 19.690], ['Tara', 43.870, 19.400],
    ['Rtanj', 43.776, 21.893], ['Stara planina', 43.380, 22.600], ['Suva planina', 43.180, 22.150],
    ['Fruška gora', 45.155, 19.708], ['Maljen (Divčibare)', 44.100, 19.990], ['Golija', 43.330, 20.290],
    ['Šar planina', 42.150, 20.980], ['Prokletije', 42.530, 20.140], ['Zlatar', 43.400, 19.820],
    ['Avala', 44.690, 20.515], ['Rudnik', 44.140, 20.510], ['Besna Kobila', 42.530, 22.210],
    ['Cer', 44.610, 19.470], ['Vršačke planine', 45.160, 21.420], ['Jastrebac', 43.400, 21.430]
  ] },
  { name: 'Varošice i sela', places: [
    ['Guča', 43.776, 20.229], ['Tršić', 44.488, 19.285], ['Mokra Gora', 43.785, 19.507],
    ['Sirogojno', 43.680, 19.880], ['Bački Petrovac', 45.360, 19.592], ['Topola', 44.254, 20.682],
    ['Despotovac', 44.093, 21.443], ['Sokobanja', 43.643, 21.870], ['Vrnjačka Banja', 43.622, 20.894],
    ['Bajina Bašta', 43.971, 19.567], ['Sremski Karlovci', 45.202, 19.934], ['Lepenski Vir', 44.557, 22.024],
    ['Golubac', 44.653, 21.632], ['Donji Milanovac', 44.464, 22.152], ['Gamzigrad', 43.900, 22.180],
    ['Banja Koviljača', 44.513, 19.153], ['Arilje', 43.753, 20.096], ['Ovčar Banja', 43.890, 20.200],
    ['Kovačica', 45.110, 20.620], ['Orašac', 44.330, 20.590], ['Kosjerić', 44.000, 19.910], ['Kuršumlija', 43.140, 21.272]
  ] },
  { name: 'Reke', rivers: true, places: [
    ['Dunav'], ['Sava'], ['Tisa'], ['Drina'], ['Tamiš'], ['Velika Morava'], ['Zapadna Morava'],
    ['Južna Morava'], ['Ibar'], ['Timok'], ['Nišava'], ['Lim'], ['Sitnica'], ['Beli Drim']
  ] }
];
if (typeof module !== 'undefined') module.exports = GEO_ROUNDS;
