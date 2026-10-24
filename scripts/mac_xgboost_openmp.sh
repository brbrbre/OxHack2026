#!/bin/sh
# XGBoost en Mac sin Homebrew: "Library not loaded: @rpath/libomp.dylib".
# Copia la libomp que trae scikit-learn junto a XGBoost dentro del entorno
# virtual, agrega @loader_path como ruta de búsqueda y vuelve a firmar.
# No toca nada fuera de .venv. Con Homebrew basta con: brew install libomp
#
# Uso, desde la raíz del repo: sh scripts/mac_xgboost_openmp.sh
set -e
PY=.venv/bin/python
$PY -m pip install -q xgboost scikit-learn
LIB=$($PY -c "import importlib.util,os;print(os.path.join(os.path.dirname(importlib.util.find_spec('xgboost').origin),'lib'))")
OMP=$($PY -c "import sklearn,os;print(os.path.join(os.path.dirname(sklearn.__file__),'.dylibs','libomp.dylib'))")
cp "$OMP" "$LIB/libomp.dylib"
otool -l "$LIB/libxgboost.dylib" | grep -q "@loader_path" || install_name_tool -add_rpath @loader_path "$LIB/libxgboost.dylib"
codesign --force -s - "$LIB/libxgboost.dylib"
$PY -c "import xgboost; print('XGBoost', xgboost.__version__, 'listo')"
