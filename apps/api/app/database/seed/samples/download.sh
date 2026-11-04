#!/usr/bin/env bash
# Downloads the demo's public sample IFC models into each project's folder (they are too big for git), and checks each
# is the exact file the saved demo estimates were made from.
set -e
cd "$(dirname "$0")"

fetch() { # folder, file, url
  [ -f "$1/$2" ] && return
  echo "downloading $2"
  curl -fsSL -o "$1/$2" "$3"
}

# A two-storey duplex (IFC2x3)
fetch ikoyi-duplex Ifc2x3_Duplex_Architecture.ifc \
  https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_Architecture.ifc

# NIBS / buildingSMART alliance Common BIM Files: Office Building, one building in three disciplines (DURAARK mirror, 27 MB zip)
if [ ! -f lekki-office/Office_ARC.ifc ] || [ ! -f lekki-office/Office_STR.ifc ] || [ ! -f lekki-office/Office_ELE.ifc ]; then
  echo "downloading the office building (three models)"
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/office.zip" https://tib.eu/data/duraark/BuildingData/01_IFC/NBU_OfficeBuilding_ifc.zip
  unzip -q "$tmp/office.zip" -d "$tmp"
  cp "$tmp/NBU_OfficeBuilding/NBU_OfficeBuilding_Arch-1.ifc" lekki-office/Office_ARC.ifc
  cp "$tmp/NBU_OfficeBuilding/NBU_OfficeBuilding_Eng-CON.ifc" lekki-office/Office_STR.ifc
  cp "$tmp/NBU_OfficeBuilding/NBU_OfficeBuilding_Eng-ELE.ifc" lekki-office/Office_ELE.ifc
  rm -rf "$tmp"
fi

# Autodesk's Revit 2024 advanced sample: a three-storey office, IFC4, one model (Viktor's public sample models, 27 MB)
fetch ikeja-office Ikeja_Office.ifc \
  https://raw.githubusercontent.com/viktor-platform/ifc-sample-models/main/sample-models/BuildingBIMModel.ifc

# the saved estimates point at these models' elements: a different file would not match them
command -v sha256sum >/dev/null && check="sha256sum -c" || check="shasum -a 256 -c"
out=$($check SHA256SUMS 2>&1) || { echo "$out"; echo "A sample model is not the file the saved estimates were made from: delete it and run this again." >&2; exit 1; }
