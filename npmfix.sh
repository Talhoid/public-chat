mkdir "${HOME}/.npm-packages"
echo NPM_PACKAGES="${HOME}/.npm-packages" >> ${HOME}/.bashrc
echo prefix=${HOME}/.npm-packages >> ${HOME}/.npmrc
echo NODE_PATH=\"\$NPM_PACKAGES/lib/node_modules:\$NODE_PATH\" >> ${HOME}/.bashrc
echo PATH=\"\$NPM_PACKAGES/bin:\$PATH\" >> ${HOME}/.bashrc
echo source "~/.bashrc" >> ${HOME}/.bash_profile
source ~/.bashrc